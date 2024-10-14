// airtable.js
const axios = require('axios');

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/helping-hands`;

async function addHelpRequest(request) {
  const response = await axios.post(AIRTABLE_URL, {
    fields: {
      HelpRequest: request,
    },
  }, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

module.exports = { addHelpRequest };
