/**
 * @author Cascade
 * @description This script lists all available Gemini models and their supported methods.
 * It is intended to be run manually to get the latest model names for the application.
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function listModels() {
  try {
    // Correctly initialize the client with an options object
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    // The listModels method is not directly on the client.
    // We need to make a direct fetch call to the discovery endpoint.
    const discoveryUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in the environment.');
    }

    const response = await fetch(`${discoveryUrl}?key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('Available Gemini Models:');
    for (const model of data.models) {
      console.log(`- ${model.name}`);
      console.log(`  - Display Name: ${model.displayName}`);
      console.log(`  - Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
    }

  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
