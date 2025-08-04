const express = require("express");
const server = require("http").createServer();
const app = express();

app.get("/", function (req, res) {
  res.sendFile("index.html", { root: __dirname });
});

server.on("request", app);
server.listen(3000, function () {
  console.log("server started on port 3000");
  console.log("Press Ctrl+C to exit, or press 'd' to see database contents");
});

// Add keyboard input handler to show database on demand
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
}

process.stdin.resume();
process.stdin.on("data", (key) => {
  // 'd' key to show database contents
  if (key.toString() === "d") {
    console.log("\n--- Showing database contents on demand ---");
    getCounts();
  }

  // Ctrl+C handling (in case our signal handler doesn't work)
  if (key.toString() === "\u0003") {
    console.log("\nCtrl+C detected directly - exiting");
    process.exit(0);
  }
});

/** Begin websocket */
const WebSocketServer = require("ws").Server;

const wss = new WebSocketServer({ server: server });

// Handle different termination signals
process.on("SIGTERM", () => {
  console.log("SIGTERM received - forcing exit");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("sigint - shutting down server...");

  // Force exit after 1 second in case something is hanging
  setTimeout(() => {
    console.log("Forcing exit...");
    process.exit(0);
  }, 1000);

  wss.clients.forEach(function each(client) {
    client.close();
  });

  server.close(() => {
    shutdownDB();
    process.exit(0); // This might not be reached if something is hanging
  });
});

wss.on("connection", function connection(ws) {
  const numClients = wss.clients.size;
  console.log("Clients connected", numClients);

  wss.broadcast(`Current visitors: ${numClients}`);

  if (ws.readyState === ws.OPEN) {
    ws.send("Welcome to my server");
  }

  db.run(`INSERT INTO visitors (count, time)
        VALUES (${numClients}, datetime('now'))
    `);

  ws.on("close", function close() {
    const currentClients = wss.clients.size;
    wss.broadcast(`Current visitors: ${currentClients}`);
    console.log("A client has disconnected");

    // Update the record with the current client count
    db.run(`INSERT INTO visitors (count, time)
        VALUES (${currentClients}, datetime('now'))
    `);
  });
});

wss.broadcast = function broadcast(data) {
  wss.clients.forEach(function each(client) {
    client.send(data);
  });
};

/** end websockets */
/** begin database */
const sqlite = require("sqlite3");
const db = new sqlite.Database(":memory:");

db.serialize(() => {
  db.run(`
        CREATE TABLE visitors (
            count INTEGER,
            time TEXT
        )
    `);
});

function getCounts() {
  console.log("All visitor records:");
  db.each("SELECT * FROM visitors", (err, row) => {
    if (err) {
      console.error("Error reading database:", err);
      return;
    }
    console.log(row);
  });
}

function shutdownDB() {
  console.log("Shutting down db");

  try {
    // Just close the database immediately
    db.close((err) => {
      if (err) {
        console.error("Error closing database:", err);
      } else {
        console.log("Database closed successfully");
      }
    });
  } catch (e) {
    console.error("Error in shutdownDB:", e);
  }
}
