const BASE_URL = 'http://localhost:3000';

async function runSimulation() {
  console.log('🚗 Starting Concurrency Simulation...\n');

  // 1. Create a new ride request
  const createRes = await fetch(`${BASE_URL}/rides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ longitude: 12.9716, latitude: 77.5946 }),
  });
  
  const createData = await createRes.json();
  const rideId = createData.ride.id;
  console.log(`✅ Ride created with ID: ${rideId}`);

  // 2. Simulate 100 drivers hitting "Accept" at the EXACT same millisecond
  const NUM_DRIVERS = 100;
  console.log(`🏎️ Firing ${NUM_DRIVERS} concurrent accept requests...`);
  
  const promises: any[] = [];
  for (let i = 1; i <= NUM_DRIVERS; i++) {
    const driverId = `driver-${i}`;
    
    // We do NOT await here. We push the promises into an array so they execute concurrently.
    const req = fetch(`${BASE_URL}/rides/${rideId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    }).then(res => res.json()).then(data => ({ driverId, ...data }));

    promises.push(req);
  }

  // Promise.all fires them all concurrently and waits for the results
  const results = await Promise.all(promises);

  // 3. Analyze the results
  console.log('\n📊 Analyzing Results...');
  const successes = results.filter((r) => r.success === true);
  const failures = results.filter((r) => r.success === false);

  console.log('--------------------------------------------------');
  console.log(`Total Requests:  ${results.length}`);
  console.log(`Successful Assignments: ${successes.length} (Expected: 1)`);
  console.log(`Rejected Requests: ${failures.length} (Expected: ${NUM_DRIVERS - 1})`);
  console.log('--------------------------------------------------');

  if (successes.length === 1) {
    console.log(`🎉 SUCCESS! Only ${successes[0].driverId} won the race condition!`);
  } else {
    console.log(`❌ FAILURE! System allowed ${successes.length} simultaneous assignments.`);
  }
}

runSimulation().catch(console.error);
