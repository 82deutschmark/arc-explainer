Using OpenAI’s Responses API with GPT‑5.1 Codex Mini
Overview of the Responses API and GPT‑5.1 Codex Mini

OpenAI’s Responses API is a new endpoint designed for rich, stateful interactions with advanced models like the GPT‑5.1 series. Unlike the older Chat Completions API, the Responses API natively supports multi-turn conversations, internal reasoning traces, and tool/function calls. Notably, GPT‑5.1-Codex-Mini (a smaller, cost-efficient coding model) is only available through this Responses API – it cannot be invoked via the /chat/completions endpoint
docs.aimlapi.com
. In other words, to integrate GPT‑5.1 Codex Mini, you must use the Responses API interface. OpenAI specifically recommends using the Responses API for GPT‑5 models because it “handles multi-turn state, tool/function calls, and richer streaming semantics” than the older APIs
skywork.ai
.

GPT‑5.1 Codex Mini is essentially a lighter version of the GPT‑5.1 Codex model, optimized for agentic coding tasks (like code generation with reasoning)
ohmygpt.com
. It supports extremely large context windows and multi-step reasoning, but proper integration requires managing conversation state through the Responses API. Below we detail how to use the official OpenAI SDK to call this model and maintain a continuous conversation with it.

Setting Up the OpenAI SDK for Responses API

First, ensure you have the latest OpenAI SDK (for example, the Python package openai or Node.js package openai) that supports the Responses API and GPT‑5.1 models. Initialize the client as usual with your API key. For example, in Python you might do:

import os
from openai import OpenAI  # Note: This is the new OpenAI SDK interface
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


And in Node.js:

import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


The Responses API methods are exposed via the client.responses interface. You will primarily use client.responses.create() to send a request and receive a response. The basic usage looks like:

Python example:

resp = client.responses.create(
    model="gpt-5.1-codex-mini",
    input={"role": "user", "content": "Your prompt here..."},
    max_output_tokens=512,
    store=True  # (More on state persistence below)
)
print(resp.output_text)


Node.js example:

const response = await openai.responses.create({
  model: "gpt-5.1-codex-mini",
  input: { role: "user", content: "Your prompt here..." },
  max_output_tokens: 512,
  store: true
});
console.log(response.output_text);


These calls demonstrate constructing a request payload for the Responses API and retrieving the assistant’s answer via response.output_text. In this simple single-turn example, we specify the model and provide a user message as the input. The model will return a JSON response object containing the output. The output_text property (provided by the SDK) gives the final assistant message text directly
docs.aimlapi.com
docs.aimlapi.com
.

Constructing Request Payloads for the Responses API

The request payload to the Responses API is JSON-based and allows complex structured input. Key fields include:

model: The model identifier to use. For GPT‑5.1 Codex Mini, use "gpt-5.1-codex-mini" (no older Chat Completion models support this – it’s exclusively on Responses API
docs.aimlapi.com
).

input: The conversation input for this turn. This field is very flexible:

It can be a simple string (e.g. "Hello"), which is shorthand for a user message content
docs.aimlapi.com
.

More often, it’s an array of message or item objects. Each object can have a role and content for messages, similar to the Chat Completions format. For example:

"input": [
  {"role": "system", "content": "You are a helpful coding assistant."},
  {"role": "user", "content": "Hello, how do I write a Python loop?"}
]


Roles can be:

"user" – end-user query or prompt.

"assistant" – a model’s previous response.

"system" or "developer" – instructions that guide the assistant’s behavior (these have higher priority than user messages
docs.aimlapi.com
).

Additionally, the Responses API input can include tool interaction items (e.g. function call results, search results, etc.) as part of the sequence. For instance, if the model previously invoked a tool, you can include a { "role": "tool", "content": ... } item with the tool’s output for the next turn
skywork.ai
. The API defines several item types (messages, tool calls, tool outputs, reasoning traces, etc.) that can appear in the input array
docs.aimlapi.com
docs.aimlapi.com
. In most simple cases, you will use message roles and possibly function-call tool outputs.

max_output_tokens: (Optional) The maximum number of tokens the model should generate in its answer
docs.aimlapi.com
docs.aimlapi.com
. This helps control response length.

temperature, top_p: (Optional) Standard generation parameters for randomness and sampling. If not specified, the model uses defaults (often temperature 1, top_p 1 for balanced creativity).

tools / tool_choice: (Optional) If you want the Codex model to be able to call functions or use tools, you can specify available tools in the request. For example, you can include a function definition under "tools" and set "tool_choice": "auto" to let the model decide when to call it
learn.microsoft.com
learn.microsoft.com
. (For pure Q&A or code generation without external calls, you can leave this as default "none" or "auto".)

store: (Optional, Boolean) Whether to store the model’s response on the server for later retrieval or chaining. By default this is false
docs.aimlapi.com
. Enabling store:true is crucial for maintaining conversation state via the API’s memory (more details below). If store is true, the response (including its messages and reasoning steps) is saved and can be referenced by ID in future requests.

previous_response_id: (Optional, String) This is used to chain the request to a previous response. Set this to the id of the last response object to carry over its context into this new request
docs.aimlapi.com
docs.aimlapi.com
. We’ll explain this in depth in the next section – it’s the key to stateful multi-turn conversations.

Other fields exist (such as include to request extra data like logprobs or encrypted reasoning tokens, prompt templates, truncation strategies, etc.), but the ones above are the primary fields for basic conversation and state control. A minimal example payload might look like:

{
  "model": "gpt-5.1-codex-mini",
  "input": [
    {"role": "user", "content": "Explain the concept of recursion in simple terms."}
  ],
  "max_output_tokens": 200,
  "temperature": 0.7,
  "store": true
}


This asks the model for an explanation, and store:true indicates the response will be saved so we can continue the conversation in a follow-up call.

Maintaining Conversation State Across Turns (Stateful Interaction)

One of the powerful features of the Responses API is built-in conversation state tracking. There are two main ways to maintain state over multiple turns:

1. Using the previous_response_id (chaining by response ID):
After you make an initial call to the model, you will receive a response object with a unique id (e.g. "resp_1234abc..."). To ask a follow-up question or otherwise continue the same conversation, you can create a new request and set previous_response_id to that ID. For example:

# First user question
r1 = client.responses.create(
    model="gpt-5.1-codex-mini",
    input=[{"role": "user", "content": "What is a binary tree?"}],
    store=True
)
print(r1.output_text)  # model's answer to first question

# Follow-up question continuing the conversation
r2 = client.responses.create(
    model="gpt-5.1-codex-mini",
    previous_response_id=r1.id,
    input=[{"role": "user", "content": "How do I implement one in Python?"}]
)
print(r2.output_text)  # model's answer uses context from the first turn


By passing previous_response_id=r1.id in the second call, we instruct the API to link this request to the prior turn’s context. The model will automatically have access to the earlier conversation content (and even its internal reasoning from the previous turn) without us needing to resend the text. In the Azure OpenAI documentation (which mirrors OpenAI’s API behavior), it’s noted that “even though we never shared the first input question with the second API call, by passing the previous_response_id the model has full context of the previous question and response”
learn.microsoft.com
learn.microsoft.com
. This means the model’s answer to the follow-up (“How do I implement one…”) will take into account both the user’s new question and the prior Q&A about binary trees.

In effect, the Responses API handles the conversation memory for you when you chain calls with previous_response_id. The state is preserved on the server between calls, as long as you have store:true so that the prior turn was saved. Each response object can be thought of as a node in a conversation chain; linking via IDs creates a chain of context.

2. Using the Conversations API (conversation objects with durable IDs):
OpenAI also provides a higher-level Conversations API that works with the Responses API to manage conversation state as a distinct object. This allows you to create a conversation (which gets its own ID) and have multiple responses within it. Under the hood it’s similar to chaining response IDs, but it offers a convenient persistent identifier for the whole session. In the OpenAI SDK, you can do something like:

conv = client.conversations.create()            # create a new conversation session
resp1 = client.responses.create(model="gpt-5.1-codex-mini", conversation=conv.id,
                                input={"role":"user","content":"...Q1..."})
resp2 = client.responses.create(model="gpt-5.1-codex-mini", conversation=conv.id,
                                input={"role":"user","content":"...Q2..."})


When you specify the same conversation ID on each call, all turns in that conversation are remembered automatically
forum.langchain.com
forum.langchain.com
. This is effectively an alternative to passing previous_response_id (the two approaches are mutually exclusive)
forum.langchain.com
. Using conversation may be cleaner for long-running chats, whereas previous_response_id is straightforward for sequential chaining. Both achieve the goal of preserving context across turns without manual prompt assembly.

3. Manual management of history (stateless mode):
It is still possible to manage conversation state entirely on the client side, similar to how one would with the Chat Completions API. In this approach, you would maintain an array of all prior messages and include them in each new request’s input. For example, after receiving resp1, you could take its output message and append it to an inputs list, then append the new user query, and send the whole list as the input for resp2. The Azure guide demonstrates this manual chaining: after the first call, do inputs += response.output and then add the next user message, then call client.responses.create with input=inputs
learn.microsoft.com
learn.microsoft.com
. This explicit approach guarantees the model sees the full conversation history because you resend it each time. However, it becomes cumbersome and may hit token limits for long chats. The preferred method for GPT-5.1 models is to use the built-in memory via previous_response_id or the Conversations API, which avoids needing to re-send large histories on every call
skywork.ai
.

In summary, for a stateful interaction with GPT-5.1 Codex Mini:

Enable state storage: Include "store": true on the initial call (and any call you want to persist) so that the conversation state is saved server-side. Without this, the Responses API operates in stateless mode, meaning it won’t retain memory between calls unless you explicitly pass it back. (Background/long-running tasks even require store=true; stateless requests aren’t supported for those
learn.microsoft.com
.)

Chain via ID or conversation: Use previous_response_id in subsequent calls to automatically carry over context
learn.microsoft.com
. This passes not only the visible dialogue but also the model’s reasoning trace (“thought process”) from the previous turn into the next, which is especially important for Codex models that use multi-step reasoning
learn.microsoft.com
. Alternatively, use a conversation ID if you’ve created one – but do not use both methods at once.

If stateless (no server memory): Then you must manage context manually. You can simply accumulate a list of {"role": ..., "content": ...} messages as the conversation progresses and send the whole list each time (just as you would with the old ChatCompletion API). Additionally, to preserve the model’s hidden reasoning from turn to turn in stateless mode, you have the option to request and include encrypted reasoning tokens. Specifically, you can ask the API to include an "encrypted_content" of the reasoning in the response, then feed that into the next request
learn.microsoft.com
docs.aimlapi.com
. This is an advanced feature: the idea is that the model’s chain-of-thought can be serialized and passed along securely if you’re not storing state on the server. For most use cases, though, it’s simpler to just use the previous_response_id mechanism with store:true so you don’t have to handle encrypted traces yourself.

How Conversation State is Passed and Updated

When you chain responses, what actually happens behind the scenes? Each Response object returned by the API contains not only the final assistant message but potentially a series of output items that include the assistant’s reasoning steps, any tool invocations, and the assistant message itself
docs.aimlapi.com
docs.aimlapi.com
. For example, a response might have an "output" list with a "reasoning" item (the model’s thought process) followed by a "message" item (the answer text)
docs.aimlapi.com
docs.aimlapi.com
. The Responses API knows how to take all these items from the previous turn and supply them as context to the next turn when you use previous_response_id. Essentially, passing the ID implicitly passes the entire conversation state (including things a normal chat user wouldn’t see, like the model’s reasoning tokens). OpenAI’s docs note: “In multi-turn conversations, passing a previous_response_id automatically makes earlier reasoning items available.” This ensures continuity of thought for the model across turns, which is important for complex coding tasks where the model’s prior reasoning affects the next answer.

From the developer perspective, the conversation state is updated with each API call as follows:

If using server-side state (store=true): Each client.responses.create() returns a response object with a unique id. That response is saved in OpenAI’s system. When you call the next prompt with previous_response_id or within the same conversation, the API will retrieve the needed history (the messages and any tool outputs/reasoning from that prior response) and include it in the new prompt context fed to the model. You don’t see this history in your request, but the model does. The new response will then contain the combined conversation (previous + new). You get a new id for the new response, which you can use for the next turn, and so on. The developer does not have to manually append or track the content beyond storing the last response ID (or maintaining a conversation object reference)
reddit.com
.

If using manual or stateless mode: You will gather the conversation history yourself. In this mode, each turn’s response’s output can be appended to your local messages list. The state is “passed” by inclusion in the next request’s input. You are effectively concatenating the conversation each time. The API isn’t doing anything special with memory here – it’s just reading whatever you send.

Does the Responses API require you to manage message history manually? Not if you use the built-in state features. The whole point of previous_response_id and the Conversations API is to avoid manual bookkeeping of chat transcripts. As one expert summarized, “for each response that you create you pass the previous response id” – that’s it, the conversation will continue where it left off
reddit.com
. Under the hood, OpenAI’s system will make earlier messages and reasoning available to the model automatically
learn.microsoft.com
. Thus, you do not need to manually supply the entire conversation each time (and doing so would double-count tokens). However, you should still store certain identifiers or data on your side:

Keep the response.id of the last turn (or the conversation ID) so you can reference it in the next call.

If needed, you can also retain the content of messages if you want to display them or log them, but you don’t have to resend them to the API if using IDs.

Finally, note that when using multi-turn state, you should consistently use the same model for continuity. GPT-5.1-Codex-Mini should be compatible with conversation chaining (including across reasoning steps), but ensure you specify that model each turn. If you switched models mid-conversation, the context might not transfer properly.

Example: Key Fields for Stateful Continuity

To tie it all together, let’s look at an example sequence highlighting the key request and response fields that enable continuity:

User’s first question: We call responses.create with:

{
  "model": "gpt-5.1-codex-mini",
  "input": [{"role": "user", "content": "Should I bring an umbrella to Seattle today?"}],
  "tools": [ ... ],        // (for example, a weather API function could be listed here)
  "store": true
}


The store:true ensures this turn is saved.

The response (say we store it in r1) comes back with an ID (r1.id like "resp_abcd1234..."). It likely contains a function call in its output (e.g., calling a get_weather function) rather than a final answer, since this might be a coding agent scenario.

Tool response turn: Suppose r1 indicated the model wants to call a function get_weather with argument "city": "Seattle". Your application executes that function and obtains a result (e.g., actual weather data). Now you need to supply that back to the model. You would call:

{
  "model": "gpt-5.1-codex-mini",
  "previous_response_id": "<r1.id>",
  "input": [
    { "role": "tool", "content": "{ \"name\": \"get_weather\", \"result\": { ... } }" }
  ],
  "store": true
}


Here we pass the previous_response_id to link to the first turn
skywork.ai
. The input is a tool output item: role "tool" with content containing the function name and its result (as JSON string). Notice we did not resend the original question; by referencing the prior response ID, the model already knows the conversation context (it knows the user asked about weather in Seattle, and it made a call). In the second response r2, the model will incorporate the tool result and likely produce a final answer like “Yes, it’s raining – you should bring an umbrella.” (The r2.output_text would contain that answer).

Next user follow-up: If the user continues the conversation (for example, “What about tomorrow?”), you again call responses.create with previous_response_id = r2.id and the new user message in input. The pattern repeats for each turn. The key fields carrying the continuity are the previous_response_id in the request and the stored content on the server associated with that ID. Each new response’s JSON will also echo the previous_response_id it used (for confirmation) and include its own new id for the next link in the chain
learn.microsoft.com
learn.microsoft.com
.

Throughout this process, message history and state are preserved without you manually concatenating prompts. If at any point you want to break or start fresh, you can omit previous_response_id (or use a new conversation ID) and the model will get no prior context (just like a brand new chat).

Important Considerations for GPT-5.1 Codex Mini Integration

Endpoint and SDK Compatibility: As mentioned, GPT-5.1 Codex Mini only works with the Responses API endpoint
docs.aimlapi.com
. Ensure your SDK call is using responses.create (not openai.ChatCompletion.create). In OpenAI’s official Python library, for example, using OpenAI(api_key=...) and then client.responses.create is the correct approach (the older openai.ChatCompletion.create won’t list this model).

Stateful by Default: The GPT-5.1 series are designed with multi-turn “agentic” interactions in mind, so leveraging conversation state will often produce better results (the model can “think” over multiple steps). If you call the model statelessly each time with no history, you might lose some of the Codex model’s advanced reasoning ability that spans turns. OpenAI explicitly notes that maintaining reasoning context across turns is “especially important when using the Responses API statelessly”, which is why they provide encrypted reasoning carry-over if needed
learn.microsoft.com
. In general, try to use the built-in state unless you have a reason not to (e.g. privacy concerns with storing data).

Managing IDs and Memory: You do not need to manage low-level memory IDs beyond the response or conversation IDs provided. There’s no separate “memory ID” you must supply; the previous_response_id is effectively the memory handle. Each turn, update your stored prev_id to the latest response’s ID, or maintain a conversation object. The conversation state on the API side updates automatically when you chain calls – you just feed in new user inputs or tool results.

Response Object Fields: In the returned response JSON/object, key fields related to state include:

id – the response ID (string) you’ll use for the next turn
docs.aimlapi.com
.

previous_response_id – this will be non-null if the response was part of a chain (it echoes what previous ID you passed in)
learn.microsoft.com
learn.microsoft.com
.

output – the list of output items (messages, reasoning, etc.) generated. If you manually stitch conversations, you might append these to your next input
learn.microsoft.com
. Otherwise, these are stored server-side.

output_text – the concatenated text of the assistant’s message output for convenience
docs.aimlapi.com
 (this is what you typically print or display as the assistant’s answer).

status – usually "completed" for a finished response, but could indicate ongoing or queued if using async/background modes.

usage – token usage statistics for that call.

Tool Calls and Functions: GPT-5.1 Codex Mini can use the Responses API’s tool-calling ability to perform actions (as shown in the weather example). Maintaining state is crucial here: after the model requests a function, you must return the result in the next call with the prior context. The chain of function_call -> tool result -> answer is managed via the same previous_response_id chaining or conversation mechanism
skywork.ai
. Make sure to include the tool output with the correct role ("tool" or specific tool output type) as part of input. The statefulness ensures the model remembers it made a call and now sees the result.

Stateless vs Stored Trade-offs: If you have data retention concerns and cannot store conversations on OpenAI’s side, you can still use the Responses API by keeping it stateless. Just remember that you then have to “play the role of memory,” meaning sending the full history each time (or using the encrypted reasoning token approach)
learn.microsoft.com
. From a technical standpoint, this is similar to how you would use the Chat API – it’s perfectly viable, just less convenient. The actual Codex Mini model will work fine either way, as long as it receives the prior messages in some form.

In conclusion, to integrate GPT-5.1 Codex Mini correctly, use the Responses API with proper state management. Construct your requests with the official SDK, include store:true for persistence, and pass previous_response_id (or a conversation ID) on follow-up calls to maintain continuity. By doing so, the model will carry on a coherent multi-turn dialogue and leverage previous context and reasoning in each response
learn.microsoft.com
learn.microsoft.com
. This approach mirrors the ChatGPT experience of a continuous conversation, but gives you programmatic control via the OpenAI API. With the examples and guidelines above, you should be able to implement a stateful conversation with GPT-5.1 Codex Mini, handling all the necessary request fields for memory and ensuring compatibility with this advanced model.

Sources: The technical details above were based on OpenAI’s documentation and community guides for the Responses API and GPT-5.1 models
docs.aimlapi.com
skywork.ai
learn.microsoft.com
learn.microsoft.com
, as well as Azure OpenAI’s guide (which aligns with OpenAI’s API) on chaining multi-turn conversations
learn.microsoft.com
learn.microsoft.com
 and preserving context
learn.microsoft.com
. These sources provide further insight into constructing requests and maintaining conversation state.