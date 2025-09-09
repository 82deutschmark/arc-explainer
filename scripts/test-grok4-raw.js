require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });
const axios = require('axios');

const testGrok4 = async () => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENROUTER_API_KEY not found in .env file.');
    return;
  }

  console.log('Testing x-ai/grok-4 on OpenRouter...');

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'x-ai/grok-4',
        messages: [
          { role: 'user', content: 'What is 2+2? Respond only with the number.' },
        ],
        max_tokens: 50,
        temperature: 0.1,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('--- API Response ---');
    console.log('Status:', response.status);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('--- Critical error during API call ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', error.response.data); // Log raw data
    } else {
      console.error('Error message:', error.message);
    }
  }
};

testGrok4();
