const express = require("express");
const router = express.Router();


//index-users
router.get("/", (req, res) => {
    res.send("GET index page!");
});
//show-users
router.get("/:id", (req, res) => {
    res.send("GET show page!");
});
//Post-users
router.post("/", (req, res) => {
    res.send("POST create page!");
});
//delete-users
router.delete("/:id", (req, res) => {
    res.send("DELETE  for user id!");
});
module.exports = router;