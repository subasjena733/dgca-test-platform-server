
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("Enter your new admin password: ", async (password) => {
  try {
    if (!password) {
      throw new Error("Password cannot be empty.");
    }

    const hash = await bcrypt.hash(password, 10);

    console.log("\nYour bcrypt hash:\n");
    console.log(hash);
  } catch (error) {
    console.error(error.message);
  } finally {
    rl.close();
  }
});
