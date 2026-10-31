require('dotenv').config();
const mongoose = require('mongoose');

async function checkAllReports() {
    await mongoose.connect(process.env.MONGO_URI);
    const reports = await mongoose.connection.db.collection('interviewreports').find().project({ title: 1, selfDescription: 1, resume: 1 }).toArray();
    console.log('Total reports:', reports.length);
    reports.forEach((r, idx) => {
        console.log('--- Report #' + (idx+1) + ' [' + r._id + '] Title: ' + r.title);
        console.log('SelfDescription:', r.selfDescription);
        console.log('Resume snippet:', (r.resume || '').slice(0, 300));
    });
    process.exit(0);
}
checkAllReports().catch(e => { console.error(e); process.exit(1); });
