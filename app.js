const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dataBasePath = path.join(__dirname, "covid19IndiaPortal.db");
let dataBase = null;

const initializeServerAndDataBase = async () => {
  try {
    db = await open({
      filename: dataBasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started...");
    });
  } catch (error) {
    console.log(`Server get an error ${error}`);
    process.exit(1);
  }
};
initializeServerAndDataBase();

const authentication = (request, response, next) => {
  let jwtToken;
  const authenticationHeader = request.headers["authorization"];
  if (authenticationHeader !== undefined) {
    jwtToken = authenticationHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const userPasswordDetails = request.body;
  const { username, password } = userPasswordDetails;

  const checkUserQuery = `
        SELECT *
        FROM user 
        WHERE username = '${username}';
    `;
  const checkUserResponse = await db.get(checkUserQuery);

  if (checkUserResponse === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      checkUserResponse.password
    );
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authentication, async (request, response) => {
  const getAllStatesQuery = `
        SELECT *
        FROM state;
    `;
  const convertToList = (eachDetails) => {
    return {
      stateId: eachDetails.state_id,
      stateName: eachDetails.state_name,
      population: eachDetails.population,
    };
  };
  const stateDetails = await db.all(getAllStatesQuery);
  response.send(stateDetails.map((eachDetails) => convertToList(eachDetails)));
});

app.get("/states/:stateId/", authentication, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `
        SELECT *
        FROM state
        WHERE state_id = ${stateId};
    `;
  const stateDetails = await db.get(stateQuery);
  response.send({
    stateId: stateDetails.state_id,
    stateName: stateDetails.state_name,
    population: stateDetails.population,
  });
});

app.post("/districts/", authentication, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const Query = `
        INSERT INTO district (district_name , state_id , cases , cured , active	, deaths )
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  await db.run(Query);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `
        SELECT *
        FROM district
        WHERE state_id = ${districtId};
    `;
    const districtDetails = await db.get(districtQuery);
    response.send({
      districtId: districtDetails.state_id,
      districtName: districtDetails.district_name,
      stateId: districtDetails.population,
      cases: districtDetails.cases,
      cured: districtDetails.cured,
      active: districtDetails.active,
      deaths: districtDetails.deaths,
    });
  }
);

app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;

    const Query = `
        DELETE 
        FROM district
        WHERE district_id = ${districtId}; 
    `;
    const dbResponse = await db.run(Query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDetails = request.body;

    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDetails;

    const updateQuery = `
        UPDATE district
        SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE district_id = ${districtId};            
    `;

    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;

    const getDetailsQuery = `
        SELECT 
            SUM(cases),SUM(cured),SUM(active),SUM(deaths)
        FROM district
        WHERE state_id = ${stateId};
    `;

    const stats = await db.get(getDetailsQuery);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);

module.exports = app;
