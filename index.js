const { App } = require('@slack/bolt');
const Airtable = require('airtable');
require('dotenv').config();

// Initialize Slack App
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

// Initialize Airtable using personal access token
const airtableBase = new Airtable({ apiKey: process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

// Submit Help Request (Slash Command)
app.command('/help-request', async ({ command, ack, respond }) => {
  await ack();
  const requestText = command.text;

  // Create a record in Airtable for the help request
  airtableBase('Help Requests').create([
    { fields: { Request: requestText, Requester: command.user_id } }
  ], (err, record) => {
    if (err) {
      return respond('Error submitting your request.');
    }

    // Post the help request message in Slack
    const message = `:help: *Help Request:* ${requestText} - Submitted by <@${command.user_id}>`;
    app.client.chat.postMessage({
      channel: command.channel_id,
      text: message
    }).then((result) => {
      respond(`Your help request has been posted! You can now chat in the thread.`);
    });
  });
});

// Handle Thread Responses (Help Claiming)
app.message(async ({ message, client, event }) => {
  // If a user replies in a thread (help claiming)
  if (message.thread_ts) {
    const helpClaimText = message.text;

    // Extract the help request details from Airtable and mark it as "Claimed"
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

// Mark Task as Finished (Slash Command)
app.command('/mark-finished', async ({ command, ack, respond }) => {
  await ack();
  const helperId = command.user_id;

  // Send the task for admin review
  const reviewChannel = 'CXXXXXXXX';  // Replace with the admin review channel ID
  await app.client.chat.postMessage({
    channel: reviewChannel,
    text: `Task Review Required:\n*Helper:* <@${helperId}>\nReact with ✅ to approve or ❌ to reject.`
  });

  await respond('The task has been sent for admin review.');
});

// Handle Admin Review (Approval or Rejection)
app.event('reaction_added', async ({ event, client }) => {
  const reviewChannel = 'CXXXXXXXX';  // The admin review channel ID

  if (event.item.channel === reviewChannel) {
    const reaction = event.reaction;
    const helperId = 'UXXXXXXXX';  // You should get the helper ID from the thread/message

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
