# Start or reset game instance

> Creates a new game session **or** resets an existing one,
depending on the presence of `guid` in the request body:

• **Omit `guid` or set it to `null`** → start a brand-new game
  instance.  
• **Provide an existing `guid`** → reset that session.  
  - If at least one ACTION command has been issued since the last
    level transition, only the **current level** is restarted.  
  - If no ACTIONs have been issued, the entire game resets.  
  Two consecutive RESETs therefore guarantee a completely fresh
  game.

The call always returns the first (or refreshed) frame of the
game state, along with updated score and win condition.


## OpenAPI

````yaml arc3v1.yaml post /api/cmd/RESET
paths:
  path: /api/cmd/RESET
  method: post
  servers:
    - url: https://three.arcprize.org
  request:
    security:
      - title: ApiKeyAuth
        parameters:
          query: {}
          header:
            X-API-Key:
              type: apiKey
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              game_id:
                allOf:
                  - type: string
                    description: Identifier of the game to start or reset (e.g. `ls20`).
              card_id:
                allOf:
                  - type: string
                    description: >
                      scorecard identifier returned by
                      **OpenScorecardResponse**. Required

                      to attribute this play to the correct scorecard.
              guid:
                allOf:
                  - type: string
                    nullable: true
                    description: >
                      Server-generated game session ID.  

                      • Omit or set to `null` to create a new game.  

                      • Provide an existing value to reset that game as
                      described above.
            required: true
            description: >
              Starts a new game session **or** resets an existing one, depending
              on

              whether a `guid` is supplied.


              • **No `guid` (null/empty)** → A brand-new game instance is
              created and
                the response will include its freshly minted `guid`.

              • **With `guid`** → The server issues a reset to that specific
                instance:
                  - If at least one ACTION command has been executed in the **current
                    level**, only that level is reset (typical “try again” behaviour).
                  - If no ACTION commands have been executed since the last level
                    transition, the entire game is reset to its initial state.


              Sending two RESET commands back-to-back therefore always yields a


              completely fresh game.


              All plays should be associated with an open scorecard via
              `card_id`

              so aggregated results can be tracked.
            refIdentifier: '#/components/schemas/ResetCommand'
            requiredProperties:
              - game_id
              - card_id
        examples:
          newGame:
            summary: Start a new session
            value:
              game_id: ls20-016295f7601e
              card_id: 8bb3b1b8-4b46-4a29-a13b-ad7850a0f916
          levelReset:
            summary: Reset current level of an existing session
            value:
              game_id: ls20-016295f7601e
              card_id: 8bb3b1b8-4b46-4a29-a13b-ad7850a0f916
              guid: 2fa5332c-2e55-4825-b5c5-df960d504470
        description: Game identifier, scorecard ID, and (optionally) the session `guid`.
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              game_id:
                allOf:
                  - type: string
                    description: Game identifier for the running session.
              guid:
                allOf:
                  - type: string
                    description: >
                      Server-generated session ID; use this for all subsequent
                      commands.
              frame:
                allOf:
                  - type: array
                    description: >
                      One or more consecutive visual frames. Each frame is a 64
                      × 64

                      grid of 4-bit colour indices (integers 0-15). Multiple
                      frames

                      may be returned if the environment advances internally
                      (e.g.,

                      animations) before settling.
                    items:
                      type: array
                      items:
                        type: array
                        items:
                          type: integer
                          minimum: 0
                          maximum: 15
              state:
                allOf:
                  - type: string
                    description: >
                      Current state of the session:


                      • **NOT_PLAYED**   - fresh session, no actions yet.


                      • **IN_PROGRESS**  - game in progress.


                      • **NOT_FINISHED** - active but non-terminal (alias that may appear).


                      • **WIN**          - session ended in victory.  


                      • **GAME_OVER**    - session ended in defeat.
                    enum:
                      - NOT_PLAYED
                      - IN_PROGRESS
                      - NOT_FINISHED
                      - WIN
                      - GAME_OVER
              score:
                allOf:
                  - type: integer
                    description: Current cumulative score for this run.
                    minimum: 0
                    maximum: 254
              win_score:
                        type: object
                        description: Additional parameters originally sent with the action.
                        additionalProperties: true
              available_actions:
                allOf:
                  - type: array
                    description: List of available actions for the current game (numeric or string tokens normalized to RESET/ACTION1-7).
                    items:
                      oneOf:
                        - type: string
                          enum:
                            - RESET
                            - ACTION1
                            - ACTION2
                            - ACTION3
                            - ACTION4
                            - ACTION5
                            - ACTION6
                            - ACTION7
                        - type: integer
                          enum:
                            - 0
                            - 1
                            - 2
                            - 3
                            - 4
                            - 5
                            - 6
                            - 7
            description: |
              Snapshot returned after every RESET or ACTION command.  
              Includes the latest visual frame(s), cumulative score details, the
              current game state, and an echo of the triggering action.
            refIdentifier: '#/components/schemas/FrameResponse'
            requiredProperties:
              - game_id
              - guid
              - frame
              - state
              - score
              - win_score
              - action_input
              - available_actions
        examples:
          frame:
            value:
              game_id: ls20-016295f7601e
              guid: 2fa5332c-2e55-4825-b5c5-df960d504470
              frame:
                - - - 0
                    - 0
                    - 0
                    - …
                  - - …
              state: NOT_FINISHED
              score: 0
              win_score: 254
              action_input:
                id: 0
                data: {}
              available_actions:
                - 1
                - 2
                - 3
                - 4
        description: First frame after starting or resetting the session.
    '400':
      _mintlify/placeholder:
        schemaArray:
          - type: any
            description: |
              Bad request - possible causes:  
              • Unknown `game_id`  
              • Missing or unknown `card_id`  
              • `guid` does not correspond to an active session
        examples: {}
        description: |
          Bad request - possible causes:  
          • Unknown `game_id`  
          • Missing or unknown `card_id`  
          • `guid` does not correspond to an active session
    '401':
      _mintlify/placeholder:
        schemaArray:
          - type: any
            description: Missing or invalid **X-API-Key** header.
        examples: {}
        description: Missing or invalid **X-API-Key** header.
  deprecated: false
  type: path
components:
  schemas: {}

````
# Execute simple action 1

> Issues **ACTION 1** to the specified game session.  
This is a single-parameter command (no X/Y coordinates): the exact
in-game effect depends on the title—for example, it might
represent “move up” or “select option A”.

The request must include:
• `game_id` — which game to act on  
• `guid` — the active session identifier returned from RESET  

An optional `reasoning` JSON blob (≤ 16 KB) can be attached for
audit or research purposes.

A successful call returns the next visual frame(s) and updated
score/state.


## OpenAPI

````yaml arc3v1.yaml post /api/cmd/ACTION1
paths:
  path: /api/cmd/ACTION1
  method: post
  servers:
    - url: https://three.arcprize.org
  request:
    security:
      - title: ApiKeyAuth
        parameters:
          query: {}
          header:
            X-API-Key:
              type: apiKey
          cookie: {}
    parameters:
      path: {}
      query: {}
      header: {}
      cookie: {}
    body:
      application/json:
        schemaArray:
          - type: object
            properties:
              game_id:
                allOf:
                  - type: string
                    description: Game identifier this action targets.
              guid:
                allOf:
                  - type: string
                    description: >-
                      Server-generated session ID obtained from a RESET
                      response.
              reasoning:
                allOf:
                  - type: object
                    description: |
                      Optional, caller-defined JSON blob (≤ 16 KB) capturing the
                      agent's internal reasoning, model parameters, or any other
                      metadata you'd like to store alongside the action.
                    additionalProperties: true
            required: true
            description: |
              Issues a one-parameter action (ACTION1 - ACTION5) to a running
              game instance identified by `guid`.
            refIdentifier: '#/components/schemas/SimpleActionCommand'
            requiredProperties:
              - game_id
              - guid
        examples:
          action:
            value:
              game_id: ls20-016295f7601e
              guid: 2fa5332c-2e55-4825-b5c5-df960d504470
              reasoning:
                policy: π_left
        description: Game/session identifiers plus optional reasoning data.
  response:
    '200':
      application/json:
        schemaArray:
          - type: object
            properties:
              game_id:
                allOf:
                  - type: string
                    description: Game identifier for the running session.
              guid:
                allOf:
                  - type: string
                    description: >-
                      Server-generated session ID; use this for all subsequent
                      commands.
              frame:
                allOf:
                  - type: array
                    description: >
                      One or more consecutive visual frames. Each frame is a 64
                      × 64

                      grid of 4-bit colour indices (integers 0-15). Multiple
                      frames

                      may be returned if the environment advances internally
                      (e.g.,

                      animations) before settling.
                    items:
                      type: array
                      items:
                        type: array
                        items:
                          type: integer
                          minimum: 0
                          maximum: 15
              state:
                allOf:
                  - type: string
                    description: >
                      Current state of the session:


                      • **NOT_PLAYED**   - fresh session, no actions yet.


                      • **IN_PROGRESS**  - game in progress.


                      • **NOT_FINISHED** - active but non-terminal (alias that may appear).


                      • **WIN**          - session ended in victory.  


                      • **GAME_OVER**    - session ended in defeat.
                    enum:
                      - NOT_PLAYED
                      - IN_PROGRESS
                      - NOT_FINISHED
                      - WIN
                      - GAME_OVER
              score:
                allOf:
                  - type: integer
                    description: Current cumulative score for this run.
                    minimum: 0
              win_score:
                allOf:
                  - type: integer
                    description: >
                      Score threshold required to reach the **WIN** state.
                      Mirrors

                      the game's configured win condition so agents can adapt

                      dynamically without hard-coding values.
                    minimum: 0
                    maximum: 254
              action_input:
                allOf:
                  - type: object
                    description: Echo of the command that produced this frame.
                    properties:
                      id:
                        type: integer
                        description: Client-assigned or sequential action index.
                      data:
                        type: object
                        description: Additional parameters originally sent with the action.
                        additionalProperties: true
              available_actions:
                allOf:
                  - type: array
                    description: List of available actions for the current game.
                    items:
                      type: integer
                      enum:
                        - 1
                        - 2
                        - 3
                        - 4
                        - 5
                        - 6
            description: |
              Snapshot returned after every RESET or ACTION command.  
              Includes the latest visual frame(s), cumulative score details, the
              current game state, and an echo of the triggering action.
            refIdentifier: '#/components/schemas/FrameResponse'
            requiredProperties:
              - game_id
              - guid
              - frame
              - state
              - score
              - win_score
              - action_input
              - available_actions
        examples:
          frame:
            value:
              game_id: ls20-016295f7601e
              guid: 2fa5332c-2e55-4825-b5c5-df960d504470
              frame:
                - - - 0
                    - 0
                    - 1
                    - …
                  - - …
              state: NOT_FINISHED
              score: 3
              win_score: 254
              action_input:
                id: 1
              available_actions:
                - 1
                - 2
                - 3
                - 4
        description: Frame returned after executing the action.
    '400':
      _mintlify/placeholder:
        schemaArray:
          - type: any
            description: |
              Bad request - possible causes:  
              • Unknown `game_id` or invalid format  
              • `guid` not found or does not belong to `game_id`  
              • `reasoning` field exceeds 16 KB or is malformed
        examples: {}
        description: |
          Bad request - possible causes:  
          • Unknown `game_id` or invalid format  
          • `guid` not found or does not belong to `game_id`  
          • `reasoning` field exceeds 16 KB or is malformed
    '401':
      _mintlify/placeholder:
        schemaArray:
          - type: any
            description: Missing or invalid **X-API-Key** header.
        examples: {}
        description: Missing or invalid **X-API-Key** header.
  deprecated: false
  type: path
components:
  schemas: {}

````