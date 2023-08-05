const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

const convertStateDbObjToResponseObj = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbObjToResponseObj = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API-1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-2

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
              *
            FROM
             state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) => convertStateDbObjToResponseObj(eachState))
  );
});

//API-3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateIdQuery = `
                SELECT
                *
                FROM
                state
                WHERE
                state_id = ${stateId};
                `;
  const stateIdResponse = await db.get(getStateIdQuery);
  response.send(convertStateDbObjToResponseObj(stateIdResponse));
});

//API-4

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO 
    district (state_id,district_name,cases,cured,active,deaths)
    VALUES (${stateId},'${districtName}',${cases},${cured},${active},${deaths});`;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

//API-5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictIdQuery = `
                SELECT
                *
                FROM
                district
                WHERE
                district_id = ${districtId};
                `;
    const districtIdResponse = await db.get(getDistrictIdQuery);
    response.send(convertDistrictDbObjToResponseObj(districtIdResponse));
  }
);

//API-6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictIdQuery = `
                DELETE
                FROM
                district
                WHERE
                district_id = ${districtId};
                `;
    await db.get(deleteDistrictIdQuery);
    response.send("District Removed");
  }
);

//API-7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictIdQuery = `
    UPDATE district
      SET
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
      WHERE
        district_id = ${districtId};`;
    await db.run(updateDistrictIdQuery);
    response.send("District Details Updated");
  }
);

//API-8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getTotStatQuery = `
                SELECT
                  SUM(cases) AS totalCases,
                  SUM(cured) AS totalCured,
                  SUM(active) AS totalActive,
                  SUM(deaths) AS totalDeaths
                FROM
                  district
                WHERE
                  state_id = ${stateId};
                `;
    const totalStatResponse = await db.get(getTotStatQuery);
    response.send(totalStatResponse);
  }
);

module.exports = app;
