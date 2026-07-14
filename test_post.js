async function test() {
  const res = await fetch('http://127.0.0.1:3000/api/admin/debate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: 'Test Debate',
      argumentFor: 'Test For',
      argumentAgainst: 'Test Against'
    })
  });
  const data = await res.json();
  console.log(data);
}
test();
