const fs = require('fs');
const dotenv = fs.readFileSync('.env.local', 'utf8');
const env = {};
dotenv.split('\n').forEach(line => {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const k = line.substring(0, idx).trim();
    const v = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

async function run() {
  const { StaffRepository } = await import('../src/modules/staff-portal/models/staff.repository.ts');
  const repo = new StaffRepository();
  const peterId = 'c0000000-0000-0000-0000-000000000007';
  const roseId = 'c0000000-0000-0000-0000-000000000008';

  const resPeter = await repo.getStaffPortalQueue(peterId);
  console.log('Peter Queue Result: success =', resPeter.success);
  console.log('Peter Next lines count:', resPeter.data?.next?.length);
  console.log('Peter Next lines:', JSON.stringify(resPeter.data?.next, null, 2));

  const resRose = await repo.getStaffPortalQueue(roseId);
  console.log('\nRose Queue Result: success =', resRose.success);
  console.log('Rose Next lines count:', resRose.data?.next?.length);
  console.log('Rose Next lines:', JSON.stringify(resRose.data?.next, null, 2));
}

run().catch(console.error);
