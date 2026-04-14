const Flutterwave = require("flutterwave-node-v3");
require("dotenv").config();

const flw = new Flutterwave(
  process.env.FLOW_SECRET_KEY,
  process.env.FLOW_PUBLIC_KEY,
);

module.exports = flw;
