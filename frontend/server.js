const express = require("express");
const app = express();
const PORT = 4201;

app.use(express.static("./browser"));

app.get("/*", (req, res) => res.sendFile("index.html", { root: __dirname }));

app.use(function (req, res, next) {
  if (!req.subdomains.length || req.subdomains.slice(-1)[0] === "www") return next();
  // otherwise we have subdomain here
  var subdomain = req.subdomains.slice(-1)[0];
  // keep it
  req.subdomain = subdomain;
  next();
});

app.listen(PORT, () => {
  console.log(`Server is now up and running @${PORT}`);
});
