# Structured model outputs

Ensure text responses from the model adhere to a JSON Schema you define. JSON is one of the most widely used formats worldwide for exchanging data between applications, and Structured Outputs guarantees that model responses match your schema so you can skip ad-hoc validation.

---

## Why Structured Outputs

Structured Outputs keeps responses compliant with a supplied [JSON Schema](https://json-schema.org/overview/what-is-jsonschema) so you never need to worry about missing keys or invalid enum values.

Benefits:

1. **Reliable type-safety** – no retries for malformed output.  
2. **Explicit refusals** – safety refusals are detectable programmatically.  
3. **Simpler prompting** – less brittle formatting instructions.

In addition to JSON Schema support in the REST API, the OpenAI SDKs for [Python](https://github.com/openai/openai-python/blob/main/helpers.md#structured-outputs-parsing-helpers) and [JavaScript](https://github.com/openai/openai-node/blob/master/helpers.md#structured-outputs-parsing-helpers) expose helpers for defining schemas via [Pydantic](https://docs.pydantic.dev/latest/) and [Zod](https://zod.dev/).

---

## Getting a structured response

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const CalendarEvent = z.object({
  name: z.string(),
  date: z.string(),
  participants: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    { role: "system", content: "Extract the event information." },
    {
      role: "user",
      content: "Alice and Bob are going to a science fair on Friday.",
    },
  ],
  text: {
    format: zodTextFormat(CalendarEvent, "event"),
  },
});

const event = response.output_parsed;
```

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class CalendarEvent(BaseModel):
    name: str
    date: str
    participants: list[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "Extract the event information."},
        {
            "role": "user",
            "content": "Alice and Bob are going to a science fair on Friday.",
        },
    ],
    text_format=CalendarEvent,
)

event = response.output_parsed
```

---

## Supported models

Structured Outputs ships with the [latest large language models](/docs/models), beginning with GPT-4o. Older models (e.g., `gpt-4-turbo`) may still rely on [JSON mode](/docs/guides/structured-outputs#json-mode).

---

## When to use Structured Outputs

Structured Outputs is available via:

1. [Function calling](/docs/guides/function-calling)  
2. A `json_schema` response format (`text.format`)

Use function calling when the model should call back into your system (database queries, UI interactions, etc.). Use Structured Outputs via `text.format` to constrain the model’s user-facing response when no tool call is required (e.g., a math tutor producing a structured JSON response for UI rendering).

---

## Structured Outputs vs JSON mode

Structured Outputs evolves [JSON mode](/docs/guides/structured-outputs#json-mode). Both ensure valid JSON, but only Structured Outputs enforces schema adherence. Structured Outputs with `response_format: { type: "json_schema", ... }` currently supports `gpt-4o-mini`, `gpt-4o-mini-2024-07-18`, and `gpt-4o-2024-08-06` snapshots and later.

|               | Structured Outputs | JSON mode |
|---------------|--------------------|-----------|
| Outputs valid JSON | Yes | Yes |
| Adheres to schema | Yes | No |
| Compatible models | gpt-4o-mini, gpt-4o-2024-08-06, later | gpt-3.5-turbo, gpt-4-*, gpt-4o-* |
| Enabling | `text: { format: { type: "json_schema", "strict": true, "schema": ... } }` | `text: { format: { type: "json_object" } }` |

---

## Examples

### Chain of thought math tutoring

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const Step = z.object({
  explanation: z.string(),
  output: z.string(),
});

const MathReasoning = z.object({
  steps: z.array(Step),
  final_answer: z.string(),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    {
      role: "system",
      content:
        "You are a helpful math tutor. Guide the user through the solution step by step.",
    },
    { role: "user", content: "how can I solve 8x + 7 = -23" },
  ],
  text: {
    format: zodTextFormat(MathReasoning, "math_reasoning"),
  },
});

const math_reasoning = response.output_parsed;
```

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class Step(BaseModel):
    explanation: str
    output: str

class MathReasoning(BaseModel):
    steps: list[Step]
    final_answer: str

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {
            "role": "system",
            "content": "You are a helpful math tutor. Guide the user through the solution step by step.",
        },
        {"role": "user", "content": "how can I solve 8x + 7 = -23"},
    ],
    text_format=MathReasoning,
)

math_reasoning = response.output_parsed
```

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {
        "role": "system",
        "content": "You are a helpful math tutor. Guide the user through the solution step by step."
      },
      {
        "role": "user",
        "content": "how can I solve 8x + 7 = -23"
      }
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "math_reasoning",
        "schema": {
          "type": "object",
          "properties": {
            "steps": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "explanation": { "type": "string" },
                  "output": { "type": "string" }
                },
                "required": ["explanation", "output"],
                "additionalProperties": false
              }
            },
            "final_answer": { "type": "string" }
          },
          "required": ["steps", "final_answer"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

Example response:

```json
{
  "steps": [
    { "explanation": "Start with the equation 8x + 7 = -23.", "output": "8x + 7 = -23" },
    { "explanation": "Subtract 7 from both sides to isolate the term with the variable.", "output": "8x = -23 - 7" },
    { "explanation": "Simplify the right side of the equation.", "output": "8x = -30" },
    { "explanation": "Divide both sides by 8 to solve for x.", "output": "x = -30 / 8" },
    { "explanation": "Simplify the fraction.", "output": "x = -15 / 4" }
  ],
  "final_answer": "x = -15 / 4"
}
```

### Structured data extraction

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const ResearchPaperExtraction = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  abstract: z.string(),
  keywords: z.array(z.string()),
});

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    {
      role: "system",
      content:
        "You are an expert at structured data extraction. You will be given unstructured text from a research paper and should convert it into the given structure.",
    },
    { role: "user", content: "..." },
  ],
  text: {
    format: zodTextFormat(ResearchPaperExtraction, "research_paper_extraction"),
  },
});

const research_paper = response.output_parsed;
```

```python
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class ResearchPaperExtraction(BaseModel):
    title: str
    authors: list[str]
    abstract: str
    keywords: list[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {
            "role": "system",
            "content": "You are an expert at structured data extraction. You will be given unstructured text from a research paper and should convert it into the given structure.",
        },
        {"role": "user", "content": "..."},
    ],
    text_format=ResearchPaperExtraction,
)

research_paper = response.output_parsed
```

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {
        "role": "system",
        "content": "You are an expert at structured data extraction. You will be given unstructured text from a research paper and should convert it into the given structure."
      },
      {
        "role": "user",
        "content": "..."
      }
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "research_paper_extraction",
        "schema": {
          "type": "object",
          "properties": {
            "title": { "type": "string" },
            "authors": {
              "type": "array",
              "items": { "type": "string" }
            },
            "abstract": { "type": "string" },
            "keywords": {
              "type": "array",
              "items": { "type": "string" }
            }
          },
          "required": ["title", "authors", "abstract", "keywords"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

Example response:

```json
{
  "title": "Application of Quantum Algorithms in Interstellar Navigation: A New Frontier",
  "authors": ["Dr. Stella Voyager", "Dr. Nova Star", "Dr. Lyra Hunter"],
  "abstract": "This paper investigates the utilization of quantum algorithms to improve interstellar navigation systems. By leveraging quantum superposition and entanglement, our proposed navigation system can calculate optimal travel paths through space-time anomalies more efficiently than classical methods. Experimental simulations suggest a significant reduction in travel time and fuel consumption for interstellar missions.",
  "keywords": [
    "Quantum algorithms",
    "interstellar navigation",
    "space-time anomalies",
    "quantum superposition",
    "quantum entanglement",
    "space travel"
  ]
}
```

### UI generation

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const UI = z.lazy(() =>
  z.object({
    type: z.enum(["div", "button", "header", "section", "field", "form"]),
    label: z.string(),
    children: z.array(UI),
    attributes: z.array(
      z.object({
        name: z.string(),
        value: z.string(),
      })
    ),
  })
);

const response = await openai.responses.parse({
  model: "gpt-4o-2024-08-06",
  input: [
    {
      role: "system",
      content: "You are a UI generator AI. Convert the user input into a UI.",
    },
    {
      role: "user",
      content: "Make a User Profile Form",
    },
  ],
  text: {
    format: zodTextFormat(UI, "ui"),
  },
});

const ui = response.output_parsed;
```

```python
from enum import Enum
from typing import List

from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class UIType(str, Enum):
    div = "div"
    button = "button"
    header = "header"
    section = "section"
    field = "field"
    form = "form"

class Attribute(BaseModel):
    name: str
    value: str

class UI(BaseModel):
    type: UIType
    label: str
    children: List["UI"]
    attributes: List[Attribute]

UI.model_rebuild()

class Response(BaseModel):
    ui: UI

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {
            "role": "system",
            "content": "You are a UI generator AI. Convert the user input into a UI.",
        },
        {"role": "user", "content": "Make a User Profile Form"},
    ],
    text_format=Response,
)

ui = response.output_parsed
```

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {
        "role": "system",
        "content": "You are a UI generator AI. Convert the user input into a UI."
      },
      {
        "role": "user",
        "content": "Make a User Profile Form"
      }
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "ui",
        "description": "Dynamically generated UI",
        "schema": {
          "type": "object",
          "properties": {
            "type": {
              "type": "string",
              "description": "The type of the UI component",
              "enum": ["div", "button", "header", "section", "field", "form"]
            },
            "label": {
              "type": "string",
              "description": "The label of the UI component, used for buttons or form fields"
            },
            "children": {
              "type": "array",
              "description": "Nested UI components",
              "items": {"$ref": "#"}
            },
            "attributes": {
              "type": "array",
              "description": "Arbitrary attributes for the UI component, suitable for any element",
              "items": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string",
                    "description": "The name of the attribute, for example onClick or className"
                  },
                  "value": {
                    "type": "string",
                    "description": "The value of the attribute"
                  }
                },
                "required": ["name", "value"],
                "additionalProperties": false
              }
            }
          },
          "required": ["type", "label", "children", "attributes"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

Example response:

```json
{
  "type": "form",
  "label": "User Profile Form",
  "children": [
    {
      "type": "div",
      "label": "",
      "children": [
        {
          "type": "field",
          "label": "First Name",
          "children": [],
          "attributes": [
            { "name": "type", "value": "text" },
            { "name": "name", "value": "firstName" },
            { "name": "placeholder", "value": "Enter your first name" }
          ]
        },
        {
          "type": "field",
          "label": "Last Name",
          "children": [],
          "attributes": [
            { "name": "type", "value": "text" },
            { "name": "name", "value": "lastName" },
            { "name": "placeholder", "value": "Enter your last name" }
          ]
        }
      ],
      "attributes": []
    },
    {
      "type": "button",
      "label": "Submit",
      "children": [],
      "attributes": [{ "name": "type", "value": "submit" }]
    }
  ],
  "attributes": [
    { "name": "method", "value": "post" },
    { "name": "action", "value": "/submit-profile" }
  ]
}
```

### Moderation

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI();

const ContentCompliance = z.object({
  is_violating: z.boolean(),
  category: z.enum(["violence", "sexual", "self_harm"]).nullable(),
  explanation_if_violating: z.string().nullable(),
});

const response = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    input: [
      {
        "role": "system",
        "content": "Determine if the user input violates specific guidelines and explain if they do."
      },
      {
        "role": "user",
        "content": "How do I prepare for a job interview?"
      }
    ],
    text: {
        format: zodTextFormat(ContentCompliance, "content_compliance"),
    },
});

const compliance = response.output_parsed;
```

```python
from enum import Enum
from typing import Optional

from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

class Category(str, Enum):
    violence = "violence"
    sexual = "sexual"
    self_harm = "self_harm"

class ContentCompliance(BaseModel):
    is_violating: bool
    category: Optional[Category]
    explanation_if_violating: Optional[str]

response = client.responses.parse(
    model="gpt-4o-2024-08-06",
    input=[
        {
            "role": "system",
            "content": "Determine if the user input violates specific guidelines and explain if they do.",
        },
        {"role": "user", "content": "How do I prepare for a job interview?"},
    ],
    text_format=ContentCompliance,
)

compliance = response.output_parsed
```

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {
        "role": "system",
        "content": "Determine if the user input violates specific guidelines and explain if they do."
      },
      {
        "role": "user",
        "content": "How do I prepare for a job interview?"
      }
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "content_compliance",
        "description": "Determines if content is violating specific moderation rules",
        "schema": {
          "type": "object",
          "properties": {
            "is_violating": {
              "type": "boolean",
              "description": "Indicates if the content is violating guidelines"
            },
            "category": {
              "type": ["string", "null"],
              "description": "Type of violation, if the content is violating guidelines. Null otherwise.",
              "enum": ["violence", "sexual", "self_harm"]
            },
            "explanation_if_violating": {
              "type": ["string", "null"],
              "description": "Explanation of why the content is violating"
            }
          },
          "required": ["is_violating", "category", "explanation_if_violating"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

Example response:

```json
{
  "is_violating": false,
  "category": null,
  "explanation_if_violating": null
}
```

---

## How to use Structured Outputs with `text.format`

### Step 1: Define your schema

Design the JSON Schema the model must follow. Structured Outputs supports much of JSON Schema, but some features are unavailable for performance reasons (see [supported schemas](#supported-schemas)).

Tips:

* Name keys clearly.  
* Add titles/descriptions.  
* Use evals to refine the structure.

### Step 2: Supply your schema

```python
response = client.responses.create(
    model="gpt-4o-2024-08-06",
    input=[
        {"role": "system", "content": "You are a helpful math tutor. Guide the user through the solution step by step."},
        {"role": "user", "content": "how can I solve 8x + 7 = -23"}
    ],
    text={
        "format": {
            "type": "json_schema",
            "name": "math_response",
            "schema": {
                "type": "object",
                "properties": {
                    "steps": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "explanation": {"type": "string"},
                                "output": {"type": "string"}
                            },
                            "required": ["explanation", "output"],
                            "additionalProperties": False
                        }
                    },
                    "final_answer": {"type": "string"}
                },
                "required": ["steps", "final_answer"],
                "additionalProperties": False
            },
            "strict": True
        }
    }
)
```

```ts
const response = await openai.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [
        { role: "system", content: "You are a helpful math tutor. Guide the user through the solution step by step." },
        { role: "user", content: "how can I solve 8x + 7 = -23" }
    ],
    text: {
        format: {
            type: "json_schema",
            name: "math_response",
            schema: {
                type: "object",
                properties: {
                    steps: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                explanation: { type: "string" },
                                output: { type: "string" }
                            },
                            required: ["explanation", "output"],
                            additionalProperties: false
                        }
                    },
                    final_answer: { type: "string" }
                },
                required: ["steps", "final_answer"],
                additionalProperties: false
            },
            strict: true
        }
    }
});
```

```bash
curl https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-2024-08-06",
    "input": [
      {
        "role": "system",
        "content": "You are a helpful math tutor. Guide the user through the solution step by step."
      },
      {
        "role": "user",
        "content": "how can I solve 8x + 7 = -23"
      }
    ],
    "text": {
      "format": {
        "type": "json_schema",
        "name": "math_response",
        "schema": {
          "type": "object",
          "properties": {
            "steps": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "explanation": { "type": "string" },
                  "output": { "type": "string" }
                },
                "required": ["explanation", "output"],
                "additionalProperties": false
              }
            },
            "final_answer": { "type": "string" }
          },
          "required": ["steps", "final_answer"],
          "additionalProperties": false
        },
        "strict": true
      }
    }
  }'
```

> **Note:** The first request you make with any schema might be slower while the API processes the schema. Subsequent calls reuse the schema cache.

### Step 3: Handle edge cases

```ts
try {
  const response = await openai.responses.create({
    model: "gpt-4o-2024-08-06",
    input: [{
        role: "system",
        content: "You are a helpful math tutor. Guide the user through the solution step by step.",
      },
      {
        role: "user",
        content: "how can I solve 8x + 7 = -23"
      },
    ],
    max_output_tokens: 50,
    text: {
      format: {
        type: "json_schema",
        name: "math_response",
        schema: {
          "type": "object",
          "properties": {
            "steps": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "explanation": {
                    "type": "string"
                  },
                  "output": {
                    "type": "string"
                  },
                },
                "required": ["explanation", "output"],
                "additionalProperties": false,
              },
            },
            "final_answer": {
              "type": "string"
            },
          },
          "required": ["steps", "final_answer"],
          "additionalProperties": false,
        },
        "strict": true,
      },
    }
  });

  if (response.status === "incomplete" && response.incomplete_details.reason === "max_output_tokens") {
    throw new Error("Incomplete response");
  }

  const math_response = response.output[0].content[0];

  if (math_response.type === "refusal") {
    console.log(math_response.refusal);
  } else if (math_response.type === "output_text") {
    console.log(math_response.text);
  } else {
    throw new Error("No response content");
  }
} catch (e) {
  console.error(e);
}
```

```python
try:
    response = client.responses.create(
        model="gpt-4o-2024-08-06",
        input=[
            {
                "role": "system",
                "content": "You are a helpful math tutor. Guide the user through the solution step by step.",
            },
            {"role": "user", "content": "how can I solve 8x + 7 = -23"},
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "math_response",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "steps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "explanation": {"type": "string"},
                                    "output": {"type": "string"},
                                },
                                "required": ["explanation", "output"],
                                "additionalProperties": False,
                            },
                        },
                        "final_answer": {"type": "string"},
                    },
                    "required": ["steps", "final_answer"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        },
    )
except Exception as e:
    pass
```

---

## Refusals with Structured Outputs

If a model refuses a user’s request for safety reasons, the API response includes a `refusal` field because the refusal may not obey your schema.

```python
class Step(BaseModel):
    explanation: str
    output: str

class MathReasoning(BaseModel):
    steps: list[Step]
    final_answer: str

completion = client.chat.completions.parse(
    model="gpt-4o-2024-08-06",
    messages=[
        {"role": "system", "content": "You are a helpful math tutor. Guide the user through the solution step by step."},
        {"role": "user", "content": "how can I solve 8x + 7 = -23"},
    ],
    response_format=MathReasoning,
)

math_reasoning = completion.choices[0].message

if math_reasoning.refusal:
    print(math_reasoning.refusal)
else:
    print(math_reasoning.parsed)
```

```ts
const Step = z.object({
    explanation: z.string(),
    output: z.string(),
});

const MathReasoning = z.object({
    steps: z.array(Step),
    final_answer: z.string(),
});

const completion = await openai.chat.completions.parse({
    model: "gpt-4o-2024-08-06",
    messages: [
        { role: "system", content: "You are a helpful math tutor. Guide the user through the solution step by step." },
        { role: "user", content: "how can I solve 8x + 7 = -23" },
    ],
    response_format: zodResponseFormat(MathReasoning, "math_reasoning"),
});

const math_reasoning = completion.choices[0].message

if (math_reasoning.refusal) {
    console.log(math_reasoning.refusal);
} else {
    console.log(math_reasoning.parsed);
}
```

Example refusal payload:

```json
{
  "id": "resp_1234567890",
  "object": "response",
  "created_at": 1721596428,
  "status": "completed",
  "error": null,
  "incomplete_details": null,
  "input": [],
  "instructions": null,
  "max_output_tokens": null,
  "model": "gpt-4o-2024-08-06",
  "output": [{
    "id": "msg_1234567890",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "refusal",
        "refusal": "I'm sorry, I cannot assist with that request."
      }
    ]
  }],
  "usage": {
    "input_tokens": 81,
    "output_tokens": 11,
    "total_tokens": 92,
    "output_tokens_details": {
      "reasoning_tokens": 0
    }
  }
}
```

---

## Tips & best practices

### Handling user-generated input

If a user message cannot produce a valid schema response, instruct the model on what to return (e.g., empty fields) to avoid hallucinations.

### Handling mistakes

Structured Outputs can still contain logical mistakes. Adjust prompts, add examples, or break the task into subtasks if needed (see [prompt engineering guide](/docs/guides/prompt-engineering)).

### Avoid schema divergence

Use the SDK’s native helpers (Pydantic/Zod) to stay aligned between schemas and code. Alternatively, add CI checks that detect drift between JSON Schema definitions and language types.

---

## Streaming

Use streaming to process responses incrementally (e.g., display JSON fields as they arrive). SDKs handle streaming events and parsing automatically.

```python
from typing import List

from openai import OpenAI
from pydantic import BaseModel

class EntitiesModel(BaseModel):
    attributes: List[str]
    colors: List[str]
    animals: List[str]

client = OpenAI()

with client.responses.stream(
    model="gpt-4.1",
    input=[
        {"role": "system", "content": "Extract entities from the input text"},
        {
            "role": "user",
            "content": "The quick brown fox jumps over the lazy dog with piercing blue eyes",
        },
    ],
    text_format=EntitiesModel,
) as stream:
    for event in stream:
        if event.type == "response.refusal.delta":
            print(event.delta, end="")
        elif event.type == "response.output_text.delta":
            print(event.delta, end="")
        elif event.type == "response.error":
            print(event.error, end="")
        elif event.type == "response.completed":
            print("Completed")

    final_response = stream.get_final_response()
    print(final_response)
```

```ts
import { OpenAI } from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const EntitiesSchema = z.object({
  attributes: z.array(z.string()),
  colors: z.array(z.string()),
  animals: z.array(z.string()),
});

const openai = new OpenAI();
const stream = openai.responses
  .stream({
    model: "gpt-4.1",
    input: [
      { role: "user", content: "What's the weather like in Paris today?" },
    ],
    text: {
      format: zodTextFormat(EntitiesSchema, "entities"),
    },
  })
  .on("response.refusal.delta", (event) => {
    process.stdout.write(event.delta);
  })
  .on("response.output_text.delta", (event) => {
    process.stdout.write(event.delta);
  })
  .on("response.output_text.done", () => {
    process.stdout.write("\n");
  })
  .on("response.error", (event) => {
    console.error(event.error);
  });

const result = await stream.finalResponse();

console.log(result);
```

---

## Supported schemas

Structured Outputs supports a subset of [JSON Schema](https://json-schema.org/docs).

### Types

* `string`, `number`, `boolean`, `integer`, `object`, `array`, `enum`, `anyOf`

### String constraints

* `pattern`  
* `format`: `date-time`, `time`, `date`, `duration`, `email`, `hostname`, `ipv4`, `ipv6`, `uuid`

### Number constraints

* `multipleOf`, `maximum`, `exclusiveMaximum`, `minimum`, `exclusiveMinimum`

### Array constraints

* `minItems`, `maxItems`

#### Example string restrictions

```json
{
  "name": "user_data",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "The name of the user"
      },
      "username": {
        "type": "string",
        "description": "The username of the user. Must start with @",
        "pattern": "^@[a-zA-Z0-9_]+$"
      },
      "email": {
        "type": "string",
        "description": "The email of the user",
        "format": "email"
      }
    },
    "additionalProperties": false,
    "required": ["name", "username", "email"]
  }
}
```

#### Example number restrictions

```json
{
  "name": "weather_data",
  "strict": true,
  "schema": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The location to get the weather for"
      },
      "unit": {
        "type": ["string", "null"],
        "description": "The unit to return the temperature in",
        "enum": ["F", "C"]
      },
      "value": {
        "type": "number",
        "description": "The actual temperature value in the location",
        "minimum": -130,
        "maximum": 130
      }
    },
    "additionalProperties": false,
    "required": ["location", "unit", "value"]
  }
}
```

> Constraints are not yet supported for fine-tuned models.

### Root object requirements

* Root must be an object (no top-level `anyOf`).  
* All fields must be `required`.  
* Emulate optional fields by allowing `null`.

```json
{
  "name": "get_weather",
  "description": "Fetches the weather in the given location",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The location to get the weather for"
      },
      "unit": {
        "type": "string",
        "description": "The unit to return the temperature in",
        "enum": ["F", "C"]
      }
    },
    "additionalProperties": false,
    "required": ["location", "unit"]
  }
}
```

```json
{
  "name": "get_weather",
  "description": "Fetches the weather in the given location",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "The location to get the weather for"
      },
      "unit": {
        "type": ["string", "null"],
        "description": "The unit to return the temperature in",
        "enum": ["F", "C"]
      }
    },
    "additionalProperties": false,
    "required": ["location", "unit"]
  }
}
```

### Size limits

* Up to 5000 object properties, 10 nesting levels.  
* Total string length (property names, enum values, etc.) ≤ 120k characters.  
* Up to 1000 enum values overall; for single enums with >250 values, combined string length ≤ 15k characters.  
* `additionalProperties: false` required for all objects.

### Ordering

Keys are emitted in the same order they appear in the schema.

### Unsupported keywords

* `allOf`, `not`, `dependentRequired`, `dependentSchemas`, `if`, `then`, `else`

Fine-tuned model limitations:

* Strings: `minLength`, `maxLength`, `pattern`, `format`  
* Numbers: `minimum`, `maximum`, `multipleOf`  
* Objects: `patternProperties`  
* Arrays: `minItems`, `maxItems`

### `anyOf` usage

Nested schemas inside `anyOf` must be valid JSON Schemas (per the subset above).

```json
{
  "type": "object",
  "properties": {
    "item": {
      "anyOf": [
        {
          "type": "object",
          "description": "The user object to insert into the database",
          "properties": {
            "name": {
              "type": "string",
              "description": "The name of the user"
            },
            "age": {
              "type": "number",
              "description": "The age of the user"
            }
          },
          "additionalProperties": false,
          "required": ["name", "age"]
        },
        {
          "type": "object",
          "description": "The address object to insert into the database",
          "properties": {
            "number": {
              "type": "string",
              "description": "The number of the address. Eg. for 123 main st, this would be 123"
            },
            "street": {
              "type": "string",
              "description": "The street name. Eg. for 123 main st, this would be main st"
            },
            "city": {
              "type": "string",
              "description": "The city of the address"
            }
          },
          "additionalProperties": false,
          "required": ["number", "street", "city"]
        }
      ]
    }
  },
  "additionalProperties": false,
  "required": ["item"]
}
```

### Definitions and recursion

Definitions are supported via `$defs`.

```json
{
  "type": "object",
  "properties": {
    "steps": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/step"
      }
    },
    "final_answer": {
      "type": "string"
    }
  },
  "$defs": {
    "step": {
      "type": "object",
      "properties": {
        "explanation": { "type": "string" },
        "output": { "type": "string" }
      },
      "required": ["explanation", "output"],
      "additionalProperties": false
    }
  },
  "required": ["steps", "final_answer"],
  "additionalProperties": false
}
```

Recursive schemas are supported via `$ref` (either `#` or `$defs` recursion).

---

## JSON mode

JSON mode ensures valid JSON but not schema adherence. Use it when Structured Outputs is unavailable.

```ts
const we_did_not_specify_stop_tokens = true;

try {
  const response = await openai.responses.create({
    model: "gpt-3.5-turbo-0125",
    input: [
      {
        role: "system",
        content: "You are a helpful assistant designed to output JSON.",
      },
      { role: "user", content: "Who won the world series in 2020? Please respond in the format {winner: ...}" },
    ],
    text: { format: { type: "json_object" } },
  });

  if (response.status === "incomplete" && response.incomplete_details.reason === "max_output_tokens") {
    // handle incomplete JSON
  }

  if (response.output[0].content[0].type === "refusal") {
    console.log(response.output[0].content[0].refusal);
  }

  if (response.status === "incomplete" and response.incomplete_details.reason === "content_filter") {
    // handle content filter
  }

  if (response.status === "completed") {
    if (we_did_not_specify_stop_tokens) {
      console.log(JSON.parse(response.output_text));
    } else {
      // handle stop tokens
    }
  }
} catch (e) {
  console.error(e);
}
```

```python
we_did_not_specify_stop_tokens = True

try:
    response = client.responses.create(
        model="gpt-3.5-turbo-0125",
        input=[
            {"role": "system", "content": "You are a helpful assistant designed to output JSON."},
            {"role": "user", "content": "Who won the world series in 2020? Please respond in the format {winner: ...}"}],
        text={"format": {"type": "json_object"}}
    )

    if response.status == "incomplete" and response.incomplete_details.reason == "max_output_tokens":
        pass

    if response.output[0].content[0].type == "refusal":
        print(response.output[0].content[0]["refusal"])

    if response.status == "incomplete" and response.incomplete_details.reason == "content_filter":
        pass

    if response.status == "completed":
        if we_did_not_specify_stop_tokens:
            print(response.output_text)
        else:
            pass
except Exception as e:
    print(e)
```

Important notes:

* Always instruct the model to output JSON; otherwise generation may hang.  
* JSON mode doesn’t guarantee schema adherence, so add validation/retries.  
* Handle edge cases (token limits, refusals, content filters) manually.

---

## Resources

* [Structured Outputs cookbook](https://cookbook.openai.com/examples/structured_outputs_intro)  
* [Multi-agent systems with Structured Outputs](https://cookbook.openai.com/examples/structured_outputs_multi_agent)

Was this page useful?
