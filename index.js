const { App } = require('@slack/bolt');
const Airtable = require('airtable');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

const airtableBase = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

// (Slash Command)
app.command('/help-request', async ({ command, ack, respond }) => {
  await ack();
  const requestText = command.text;

  airtableBase('Help Requests').create([
    { fields: { Request: requestText, Requester: command.user_id } }
  ], (err, record) => {
    if (err) {
      return respond('Error submitting your request.');
    }

    // Post the help request message
    const message = `:help: *Help Request:* ${requestText} - Submitted by <@${command.user_id}>`;
    app.client.chat.postMessage({
      channel: command.channel_id,
      text: message
    }).then((result) => {
      respond(`Your help request has been posted! You can now chat in the thread.`);
    });
  });
});

app.message(async ({ message, client, event }) => {
  if (message.thread_ts) {
    const helpClaimText = message.text;
    airtableBase('Help Requests').select({ filterByFormula: `{Slack Thread ID} = '${message.thread_ts}'` }).firstPage((err, records) => {
      if (records.length > 0) {
        const requestRecord = records[0];
        airtableBase('Help Requests').update(requestRecord.id, { "Helper": message.user }, (err, record) => {
          if (err) {
            client.chat.postMessage({
              channel: message.channel,
              thread_ts: message.thread_ts,
              text: 'Error claiming the help request.'
            });
          } else {
            client.chat.postMessage({
              channel: message.channel,
              thread_ts: message.thread_ts,
              text: `<@${message.user}> has claimed this help request! You can now chat in this thread about what needs to be done.`
            });
          }
        });
      }
    });
  }
});

//Slash Command)
app.command('/mark-finished', async ({ command, ack, respond }) => {
  await ack();
  const helperId = command.user_id;

  //
  const reviewChannel = 'C07RD7F7NTY'; 
  await app.client.chat.postMessage({
    channel: reviewChannel,
    text: `Task Review Required:\n*Helper:* <@${helperId}>\nReact with ✅ to approve or ❌ to reject.`
  });

  await respond('The task has been sent for admin review.');
});

app.event('reaction_added', async ({ event, client }) => {
  const reviewChannel = 'CXXXXXXXX';  // The admin review channel ID

  if (event.item.channel === reviewChannel) {
    const reaction = event.reaction;
    const helperId = 'UXXXXXXXX';

    if (reaction === 'white_check_mark') {
      const pointsToAdd = 1;
      airtableBase('Users').select({ filterByFormula: `{User ID} = '${helperId}'` }).firstPage((err, records) => {
        if (records.length > 0) {
          const userRecord = records[0];
          const currentPoints = userRecord.fields['Points'];
          airtableBase('Users').update(userRecord.id, { 'Points': currentPoints + pointsToAdd }, () => {
            client.chat.postMessage({
              channel: helperId,
              text: `Your task was approved! You've earned ${pointsToAdd} point(s). You now have ${currentPoints + pointsToAdd} points.`
            });
          });
        } else {
          airtableBase('Users').create([{ fields: { 'User ID': helperId, 'Points': pointsToAdd } }], () => {
            client.chat.postMessage({
              channel: helperId,
              text: `Your task was approved! You've earned your first ${pointsToAdd} point(s).`
            });
          });
        }
      });
    } else if (reaction === 'x') {
      client.chat.postMessage({
        channel: helperId,
        text: 'Your task was not approved.'
      });
    }
  }
});

// Start the Slack App
(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('⚡️ Slack bot is running!');
})();
