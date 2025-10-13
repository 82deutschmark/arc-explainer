Guide to the OpenAI Responses API

This API is required for stateful conversations and models with internal reasoning (like GPT-5). It replaces the old ChatCompletions API.

Key Rules for Success:

Use input, Not messages: Your request body must use the input key, which takes an array of role/content objects. Sending the old messages key will fail.
Request Reasoning: For models that think step-by-step, you must include the reasoning parameter (e.g., reasoning: { "summary": "auto" }). If you don't, you won't get the model's thought process.
Parse the output Array: The response is not a single text field. It's an output array containing different blocks like message and reasoning. Your code must loop through this array to find the final text (content with type: "output_text") and the reasoning logs.
Set max_output_tokens Generously: Reasoning consumes output tokens. If the limit is too low, the model will complete its reasoning but have no tokens left to generate the final answer, resulting in an empty reply.
Use IDs for Conversation History: To continue a conversation, save the response.id from the previous turn and pass it as previous_response_id in your next request. This is how the API maintains state.