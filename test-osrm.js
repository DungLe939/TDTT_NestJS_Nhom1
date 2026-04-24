const axios = require('axios');
const modes = ['driving', 'foot', 'bicycle'];
async function test() {
  for (let mode of modes) {
    try {
      const url = `http://router.project-osrm.org/route/v1/${mode}/109.1943,12.2458;109.2,12.25?overview=full&geometries=geojson&steps=true`;
      await axios.get(url, { headers: { 'User-Agent': 'Smart-Tourism-App-HCMUS' }});
      console.log(`${mode}: OK`);
    } catch(e) {
      console.log(`${mode}: ERROR ${e.response ? e.response.status : e.message}`);
    }
  }
}
test();
