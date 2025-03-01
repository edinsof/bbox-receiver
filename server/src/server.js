const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { readFileSync } = require("fs");

const app = express();
app.use(bodyParser.json());

const config = JSON.parse(
  readFileSync(path.join(__dirname, "..", "config.json"), "utf8")
);

const authConfig = new Map();

config?.auth?.forEach((object) => {
  authConfig.set(object.user, object.key);
});

app.post("/sls/event", (req, res) => {
  /*
		  {
			  on_event: 'on_connect' | 'on_close',
			  role_name: 'publisher',
			  srt_url: 'input/live/pack',
			  remote_ip: '172.17.0.1',
			  remote_port: '57374'
		  }
	  */
  console.log("event", req.query);
  const { query } = req;
  const { role_name, srt_url, remote_ip, remote_port } = query;
  const srtUrl = srt_url.split("/");
  const [, , streamName] = srtUrl;
  if (!streamName) {
    res.status(400).send("Invalid stream name");
    return;
  }
  // get streamKey from streamName in format ?srtauth=<streamkey>
  const [streamer, p] = streamName?.split("?");
  const params = new URLSearchParams(p);

  const streamKey = params.get("srtauth");

  if (query.on_event === "on_connect") {
    if (streamKey) {
      const auth = authConfig.get(streamer);
      if (auth === streamKey) {
        console.log(`${role_name} connected to ${streamer}`);
        res.sendStatus(200);
        return;
      } else {
        console.log(`${role_name} connected to ${streamer} with wrong key`);
        res.sendStatus(401);
        return;
      }
    }
  } else if (query.on_event === "on_close") {
    console.log(`${role_name} disconnected from ${streamer}`);
    res.sendStatus(200);
  } else {
    console.log(`${role_name} connected to ${streamer} with wrong event`);
    res.sendStatus(401);
  }
});

app.get("/stats", async (req, res) => {
  // URL: /sls/stats?streamer=<streamer>&key=<key>
  const { query } = req;
  const { streamer, key } = query;
  const auth = authConfig.get(streamer);
  const authed = auth === key && streamer && key;
  let result = [];
  if (authed) {
    try {
      const publisherName = `live/stream/${streamer}?srtauth=${auth}`;
      // get data from stats page at localhost:8181/stats
      const data = await fetch(
        `http://localhost:8181/stats?publisher=${encodeURIComponent(
          publisherName
        )}`
      );
      const json = await data.json();
      result = json?.publishers;
    } catch (e) {
      console.log(e);
    }
   return res.status(200).json({
     publishers: result,
     status: "ok"
   });
  }
  return res.status(200).json({
    status: "error",
  });
});

app.listen(3000, () => console.log("Server started"));
