const puppeteer = require("puppeteer");
const micro = require("micro");
const { send, json } = require("micro");
const { router, get, options, post } = require("microrouter");
const cors = require("micro-cors")();
const stripe = require("stripe")("sk_test_0MlrnptIXnNfzxc33n0eepFl");

const optionsHandler = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Origin"
  );
  send(res, 200);
};

const generatePDFHandler = async (req, res) => {
  const {
    resume,
    margin,
    websiteUrl,
    themeColor,
    stripeToken,
    pdfOnly,
    email
  } = await json(req);
  if (
    !resume ||
    !websiteUrl ||
    !margin ||
    !themeColor ||
    !stripeToken ||
    !pdfOnly
  ) {
    return send(res, 400, "Bad request");
  }

  const stripeConfirmation = await stripe.charges.create({
    amount: pdfOnly ? 100 : 500,
    currency: "usd",
    source: process.env.ENVIRONMENT !== "PRODUCTION" ? "tok_visa" : stripeToken,
    receipt_email: email ? email : null
  });

  const { left: marginLeft, right: marginRight } = margin;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();
  await page.goto(websiteUrl);
  page.emulateMedia("screen");

  await page.evaluate(
    async ({ resume, themeColor }) => {
      debugger;
      await window.loadJson(resume, themeColor);
      const selectors = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        selectors.map(img => {
          if (img.complete) return;
          return new Promise((resolve, reject) => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", reject);
          });
        })
      );
    },
    { resume, themeColor }
  );

  const pdf = await page.pdf({
    margin: { left: marginLeft, right: marginRight }
  });
  await browser.close();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Length", pdf.length);
  return send(res, 200, pdf);
};

const routes = router(
  post("/", cors(generatePDFHandler)),
  get("/", optionsHandler),
  options("/", cors(optionsHandler))
);

const server = micro(routes);

server.listen();

module.exports = routes;
