import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import cors from "cors";
import methodOverride from "method-override";
import bcrypt from "bcrypt";

const { Pool } = pkg;

const app = express();
const port = 3000;

let currentUser = null;

// middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride("_method"));
app.use(express.static("public"));
app.use((req, res, next) => {
  res.locals.user = currentUser;
  next();
});
// DB connection


const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "TPMS",
  password: "Your_password",
  port: 5432,
});

app.get("/home", (req, res) => {
  res.render("index.ejs", { user: currentUser });
});

app.get("/", (req, res) => {
  res.render("login.ejs", { error: null });
});

app.post("/", async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.render("login.ejs", { error: "User does not exist" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("login.ejs", { error: "Incorrect password" });
    }

    if (user.role !== role) {
      return res.render("login.ejs", { error: "Wrong role selected" });
    }

    currentUser = {
      id: user.user_id,
      name: user.name,
      role: user.role
    };

    res.redirect("/home");

  } catch (err) {
    console.error(err);
    res.send("Login error");
  }
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs", { error: null });
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const defaultRole = "user";
  try {
    // check if user exists
    const check = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (check.rows.length > 0) {
      return res.render("signup.ejs", { error: "User already exists" });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      [name, email, hashedPassword, defaultRole]
    );
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.send("Signup error");
  }
});

//zones
app.get("/zones", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM zones ORDER BY zone_id");
    res.render("zones.ejs", {
      zones: result.rows,
      user: currentUser
    });
  } catch (err) {
    console.error(err);
    res.send("Error loading zones");
  }
});

app.post("/zones", async (req, res) => {
  try {
    const { area } = req.body;

    const result = await pool.query(
      "INSERT INTO zones (area) VALUES ($1) RETURNING *",
      [area]
    );

    res.redirect("/zones");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating zone");
  }
});


app.post("/zones/update/:id", async (req, res) => {
  const { id } = req.params;
  const { area } = req.body;

  await pool.query(
    "UPDATE zones SET area = $1 WHERE zone_id = $2",
    [area, id]
  );

  res.redirect("/zones");
});



//saplings

app.post("/saplings", async (req, res) => {
  try {
    const { species_id, zone_id, plant_date, status, height } = req.body;

    let user_id;

    if (currentUser.role === "admin") {
      user_id = req.body.user_id;
    } else {
      user_id = currentUser.id; // force user ownership
    }

    await pool.query(
      `INSERT INTO saplings 
      (species_id, zone_id, user_id, plant_date, status, height)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [species_id, zone_id, user_id, plant_date, status, height]
    );

    res.redirect("/saplings");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating sapling");
  }
});
app.get("/saplings", async (req, res) => {
  try {
    if (!currentUser) {
      return res.redirect("/");
    }

    const view = req.query.view;
    const user = currentUser;

    let saplingsResult;

    if (user.role === "admin") {
      saplingsResult = await pool.query(`
        SELECT s.sapling_id, sp.name AS species, z.zone_id, u.name AS planted_by,
               s.plant_date, s.status, s.height, s.user_id
        FROM saplings s
        JOIN species sp ON s.species_id = sp.species_id
        JOIN zones z ON s.zone_id = z.zone_id
        JOIN users u ON s.user_id = u.user_id
      `);
    } else if (view === "all") {
      saplingsResult = await pool.query(`
        SELECT s.sapling_id, sp.name AS species, z.zone_id, u.name AS planted_by,
               s.plant_date, s.status, s.height, s.user_id
        FROM saplings s
        JOIN species sp ON s.species_id = sp.species_id
        JOIN zones z ON s.zone_id = z.zone_id
        JOIN users u ON s.user_id = u.user_id
      `);
    } else {
      saplingsResult = await pool.query(`
        SELECT s.sapling_id, sp.name AS species, z.zone_id, u.name AS planted_by,
               s.plant_date, s.status, s.height, s.user_id
        FROM saplings s
        JOIN species sp ON s.species_id = sp.species_id
        JOIN zones z ON s.zone_id = z.zone_id
        JOIN users u ON s.user_id = u.user_id
        WHERE s.user_id = $1
      `, [user.id]);
    }

    const zonesResult = await pool.query("SELECT * FROM zones");
    const speciesResult = await pool.query("SELECT * FROM species");
    const usersResult = await pool.query("SELECT * FROM users");

    res.render("saplings.ejs", {
      saplings: saplingsResult.rows,
      zones: zonesResult.rows,
      species: speciesResult.rows,
      users: usersResult.rows,
      user: user,
      view: view
    });

  } catch (err) {
    console.error("SAPLINGS ERROR:", err);
    res.send(err.message);
  }
});

app.post("/saplings/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await pool.query(
      "UPDATE saplings SET status = $1 WHERE sapling_id = $2",
      [status, id]
    );

    res.redirect("/saplings");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating sapling");
  }
});

//reports

app.get("/reports", async (req, res) => {
  try {
    // zone count
    const zoneReport = await pool.query(`
      SELECT z.zone_id, COUNT(s.sapling_id) AS total_saplings
      FROM zones z
      LEFT JOIN saplings s ON z.zone_id = s.zone_id
      GROUP BY z.zone_id
      ORDER BY z.zone_id
    `);

    // survival rate
    const survivalReport = await pool.query(`
    SELECT 
    z.zone_id,
    COUNT(s.sapling_id) AS total,
    COUNT(CASE WHEN s.status = 'Alive' THEN 1 END) AS alive,
    COUNT(CASE WHEN s.status = 'Dead' THEN 1 END) AS dead,
    COUNT(CASE WHEN s.status = 'Diseased' THEN 1 END) AS diseased,
    ROUND(
      (COUNT(CASE WHEN s.status = 'Alive' THEN 1 END) * 100.0) /
      NULLIF(COUNT(s.sapling_id), 0),
      2
    ) AS survival_rate
    FROM zones z
    LEFT JOIN saplings s ON z.zone_id = s.zone_id
    GROUP BY z.zone_id
    ORDER BY z.zone_id
`);

    res.render("reports.ejs", {
      zoneReport: zoneReport.rows,
      survivalReport: survivalReport.rows,
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading reports");
  }
});


app.get("/reports/zones", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT z.zone_id, COUNT(s.sapling_id) AS total_saplings
      FROM zones z
      LEFT JOIN saplings s ON z.zone_id = s.zone_id
      GROUP BY z.zone_id
      ORDER BY z.zone_id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating zone report");
  }
});

app.get("/reports/survival", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        z.zone_id,
        COUNT(s.sapling_id) AS total,
        COUNT(CASE WHEN s.status = 'Alive' THEN 1 END) AS alive,
        ROUND(
          (COUNT(CASE WHEN s.status = 'Alive' THEN 1 END) * 100.0) /
          NULLIF(COUNT(s.sapling_id), 0),
          2
        ) AS survival_rate
      FROM zones z
      LEFT JOIN saplings s ON z.zone_id = s.zone_id
      GROUP BY z.zone_id
      ORDER BY z.zone_id
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating survival report");
  }
});

//maintainence
app.post("/maintenance", async (req, res) => {
  try {
    const { sapling_id, date, activity, remarks } = req.body;

    let user_id;

    if (currentUser.role === "admin") {
      user_id = req.body.user_id;
    } else {
      user_id = currentUser.id; // force user ownership
    }

    await pool.query(
      `INSERT INTO maintenance 
      (sapling_id, user_id, date, activity, remarks)
      VALUES ($1, $2, $3, $4, $5)`,
      [sapling_id, user_id, date, activity, remarks]
    );

    res.redirect("/maintenance");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding maintenance log");
  }
});

app.get("/maintenance", async (req, res) => {
  try {
    let logsResult;

    if (currentUser.role === "admin") {
      // admin → all logs
      logsResult = await pool.query(`
        SELECT m.maintenance_id, s.sapling_id, u.name AS done_by,
           m.date, m.activity, m.remarks
        FROM maintenance m
        JOIN saplings s ON m.sapling_id = s.sapling_id
        JOIN users u ON m.user_id = u.user_id
        ORDER BY m.date DESC
        ` );
    } else {
      // user → only his logs
      logsResult = await pool.query(`
    SELECT m.maintenance_id, s.sapling_id, u.name AS done_by,
           m.date, m.activity, m.remarks
    FROM maintenance m
    JOIN saplings s ON m.sapling_id = s.sapling_id
    JOIN users u ON m.user_id = u.user_id
    WHERE m.user_id = $1
    ORDER BY m.date DESC
  `, [currentUser.id]);
    }

    let saplingsResult;

    if (currentUser.role === "admin") {
      saplingsResult = await pool.query("SELECT * FROM saplings");
    } else {
      saplingsResult = await pool.query(
        "SELECT * FROM saplings WHERE user_id = $1",
        [currentUser.id]
      );
    }

    const usersResult = await pool.query("SELECT * FROM users");

    res.render("maintenance.ejs", {
      logs: logsResult.rows,
      saplings: saplingsResult.rows,
      users: usersResult.rows,
      user: currentUser
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading maintenance");
  }
});

//species
app.get("/species", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM species ORDER BY species_id");

    res.render("species.ejs", {
      species: result.rows,
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading species");
  }
});

app.post("/species", async (req, res) => {
  try {
    const { name, scientific_name, growth_type, average_lifespan } = req.body;

    await pool.query(
      `INSERT INTO species 
       (name, scientific_name, growth_type, average_lifespan)
       VALUES ($1, $2, $3, $4)`,
      [name, scientific_name, growth_type, average_lifespan]
    );

    res.redirect("/species");

  } catch (err) {
    console.error(err);
    res.send("Error adding species");
  }
});

//users

app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY user_id");

    res.render("users.ejs", {
      users: result.rows,
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading users");
  }
});

// USER REQUEST ROUTES (POST)

app.post("/zones/request", async (req, res) => {
  try {
    const { area } = req.body;
    await pool.query("INSERT INTO zone_requests (user_id, area) VALUES ($1, $2)", [currentUser.id, area]);
    res.redirect("/zones");
  } catch (err) { console.error(err); res.send("Error"); }
});

app.post("/species/request", async (req, res) => {
  try {
    const { name, scientific_name, growth_type, average_lifespan } = req.body;
    await pool.query(
      "INSERT INTO species_requests (user_id, name, scientific_name, growth_type, average_lifespan) VALUES ($1, $2, $3, $4, $5)",
      [currentUser.id, name, scientific_name, growth_type, average_lifespan]
    );
    res.redirect("/species");
  } catch (err) { console.error(err); res.send("Error"); }
});

app.post("/maintenance/request", async (req, res) => {
  try {
    const { sapling_id, date, activity, remarks } = req.body;
    await pool.query(
      "INSERT INTO maintenance_requests (user_id, sapling_id, date, activity, remarks) VALUES ($1, $2, $3, $4, $5)",
      [currentUser.id, sapling_id, date, activity, remarks]
    );
    res.redirect("/maintenance");
  } catch (err) { console.error(err); res.send("Error"); }
});

// ADMIN MANAGE REQUESTS ROUTES

app.get("/requests", async (req, res) => {
  try {
    const zoneReqs = await pool.query(`
      SELECT zr.*, u.name 
      FROM zone_requests zr 
      JOIN users u ON zr.user_id = u.user_id
    `);

    const speciesReqs = await pool.query(`
      SELECT sr.*, sr.name AS species_name, u.name AS user_name 
      FROM species_requests sr 
      JOIN users u ON sr.user_id = u.user_id
    `);

    const maintReqs = await pool.query(`
      SELECT mr.*, u.name 
      FROM maintenance_requests mr 
      JOIN users u ON mr.user_id = u.user_id
    `);

    res.render("requests.ejs", {
      zoneReqs: zoneReqs.rows,
      speciesReqs: speciesReqs.rows,
      maintReqs: maintReqs.rows
    });
  } catch (err) { console.error(err); res.send("Error loading requests"); }
});

// Admin Zone Action
app.post("/requests/zones/:id/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    const reqData = await pool.query("SELECT * FROM zone_requests WHERE request_id = $1", [id]);
    const r = reqData.rows[0];

    if (action === "accept") {
      await pool.query("INSERT INTO zones (area) VALUES ($1)", [r.area]);
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your request to add Zone Area ${r.area} was ACCEPTED.`]);
    } else {
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your request to add Zone Area ${r.area} was DECLINED.`]);
    }

    await pool.query("DELETE FROM zone_requests WHERE request_id = $1", [id]);
    res.redirect("/requests");
  } catch (err) { console.error(err); res.send("Error processing request"); }
});

// Admin Species Action
app.post("/requests/species/:id/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    const reqData = await pool.query("SELECT * FROM species_requests WHERE request_id = $1", [id]);
    const r = reqData.rows[0];

    if (action === "accept") {
      await pool.query("INSERT INTO species (name, scientific_name, growth_type, average_lifespan) VALUES ($1, $2, $3, $4)", [r.name, r.scientific_name, r.growth_type, r.average_lifespan]);
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your request to add Species '${r.name}' was ACCEPTED.`]);
    } else {
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your request to add Species '${r.name}' was DECLINED.`]);
    }

    await pool.query("DELETE FROM species_requests WHERE request_id = $1", [id]);
    res.redirect("/requests");
  } catch (err) { console.error(err); res.send("Error processing request"); }
});

// Admin Maintenance Action
app.post("/requests/maintenance/:id/:action", async (req, res) => {
  try {
    const { id, action } = req.params;
    const reqData = await pool.query("SELECT * FROM maintenance_requests WHERE request_id = $1", [id]);
    const r = reqData.rows[0];

    if (action === "accept") {
      await pool.query("INSERT INTO maintenance (sapling_id, user_id, date, activity, remarks) VALUES ($1, $2, $3, $4, $5)", [r.sapling_id, r.user_id, r.date, r.activity, r.remarks]);
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your maintenance request for Sapling ${r.sapling_id} was ACCEPTED.`]);
    } else {
      await pool.query("INSERT INTO notifications (user_id, message) VALUES ($1, $2)", [r.user_id, `Your maintenance request for Sapling ${r.sapling_id} was DECLINED.`]);
    }

    await pool.query("DELETE FROM maintenance_requests WHERE request_id = $1", [id]);
    res.redirect("/requests");
  } catch (err) { console.error(err); res.send("Error processing request"); }
});

// USER NOTIFICATIONS ROUTES

app.get("/notifications", async (req, res) => {
  if (!currentUser) return res.redirect("/home");
  try {
    const result = await pool.query("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC", [currentUser.id]);
    res.render("notifications.ejs", { notifications: result.rows });
  } catch (err) { console.error(err); res.send("Error loading notifications"); }
});

app.post("/notifications/clear", async (req, res) => {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id = $1", [currentUser.id]);
    res.redirect("/notifications");
  } catch (err) { console.error(err); res.send("Error clearing notifications"); }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

