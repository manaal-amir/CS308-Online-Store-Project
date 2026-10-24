require('dotenv').config();
const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 3000;

async function main() {
  await prisma.$connect();
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

main().catch((e) => { console.error(e); process.exit(1); });