import axios from 'axios';

async function testAPI() {
  try {
    console.log('Testing API endpoint...');
    const response = await axios.post('http://localhost:5000/api/analyze', {
      puzzleId: '007bbfb7',
      modelKey: 'grok-4-fast',
      temperature: 0.2,
      promptId: 'solver',
      systemPromptMode: 'ARC'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000
    });

    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers['content-type']);
    console.log('Response type:', typeof response.data);

    if (typeof response.data === 'string') {
      console.log('Response is HTML/string (first 200 chars):', response.data.substring(0, 200));
    } else {
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testAPI();
