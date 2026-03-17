import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import OpenAI from 'openai';
import { ChatCompletionMessage } from 'openai/resources';
import Anthropic from '@anthropic-ai/sdk';
import { OpenRouter } from '@openrouter/sdk';
import { AssistantMessage, ChatResponse } from '@openrouter/sdk/esm/models';
import { IELTSPrompts, ItemI } from 'apps/common/src/database/mongodb';

// export const OpenAITaskPrompt1 = async (promptQuery: string): Promise<ChatCompletionMessage> => {
//   try {
//     // const anthropic = new Anthropic({
//     //   apiKey: // defaults to process.env["ANTHROPIC_API_KEY"]
//     // });
//     const chatCompletion = await new Anthropic({
//       apiKey: // defaults to process.env["ANTHROPIC_API_KEY"]
//     }).messages.create({
//       model: 'claude-3-7-sonnet-latest',
//       max_tokens: 1024,
//       messages: [{ role: 'user', content: promptQuery }],
//     });
//     console.log('msg >>>>>>>>>>>>>>>>>', chatCompletion);
//     if (chatCompletion.content.length > 0) {
//       const choice = JSON.parse(chatCompletion.content[0]['text']);
//       // console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
//       console.log('choice ', JSON.stringify(choice, null, 2));

//       return choice;
//     }

//     // const openai = new OpenAI({
//     //   apiKey: process.env.OPEN_AI_KEY,
//     // });

//     // console.log('promptQuery >>>>>>>>>> ', promptQuery);

//     // const chatCompletion = await openai.chat.completions.create({
//     //   model: 'gpt-4o-2024-08-06',
//     //   messages: [{ role: 'user', content: promptQuery }],
//     //   response_format: {
//     //     type: 'json_object',
//     //   },
//     //   //   temperature: 0.9,
//     //   //   top_p: 1,
//     //   //   max_tokens: 2000,
//     //   //   frequency_penalty: 0,
//     //   //   presence_penalty: 0.6,
//     //   //   stop: [' Human:', ' AI:'],
//     // });
//     // .catch(() => null);

//     // console.log(chatCompletion.choices);
//     // //   console.log('openAIResponse.data.choices >>>>>>>>> ', openAIResponse?.data?.choices);

//     // if (chatCompletion.choices.length > 0) {
//     //   const choice = chatCompletion.choices[0].message;
//     //   console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
//     //   console.log('choice ', JSON.stringify(choice, null, 2));

//     //   return choice;

//     // const jsonStartIndex = choice.indexOf('{');
//     // const jsonEndIndex = choice.lastIndexOf('}');
//     // const jsonString = choice.slice(jsonStartIndex, jsonEndIndex + 1);
//     // console.log('slice >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ', JSON.stringify(jsonString));
//     // console.log('slice but parse ', fmt2json(jsonString));
//     // const parseJSONData = fmt2json(jsonString); //JSON.parse(jsonString);

//     // const objectPath = FindObjectPath(parseJSONData, 'result');

//     // const extractedJSONData =
//     //   objectPath.length > 0
//     //     ? objectPath.reduce((pv, cv) => {
//     //         if (pv) {
//     //           return pv[cv];
//     //         }
//     //         return parseJSONData[cv];
//     //       }, null)
//     //     : parseJSONData;
//     // return extractedJSONData;
//     // }
//     throw new Error(JSON.stringify(chatCompletion));
//   } catch (error) {
//     console.log('OpenAITaskPrompt Error: ', error, JSON.stringify(error?.response, null, 2));
//     // throw new Error(error);
//     return null;
//   }
// };

// export const ClaudeTaskPrompt = async (promptQuery: string): Promise<ChatCompletionMessage> => {
//   try {
//     const openai = new OpenAI({
//       apiKey://process.env.OPEN_AI_KEY,
//     });

//     console.log('promptQuery >>>>>>>>>> ', promptQuery);

//     const chatCompletion = await openai.chat.completions.create({
//       model: 'gpt-4o-2024-08-06',
//       messages: [{ role: 'user', content: promptQuery }],
//       response_format: {
//         type: 'json_object',
//       },
//       //   temperature: 0.9,
//       //   top_p: 1,
//       //   max_tokens: 2000,
//       //   frequency_penalty: 0,
//       //   presence_penalty: 0.6,
//       //   stop: [' Human:', ' AI:'],
//     });
//     // .catch(() => null);

//     console.log(chatCompletion.choices);
//     //   console.log('openAIResponse.data.choices >>>>>>>>> ', openAIResponse?.data?.choices);

//     if (chatCompletion.choices.length > 0) {
//       const choice = chatCompletion.choices[0].message;
//       console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
//       console.log('choice ', JSON.stringify(choice, null, 2));

//       return choice;

//       // const jsonStartIndex = choice.indexOf('{');
//       // const jsonEndIndex = choice.lastIndexOf('}');
//       // const jsonString = choice.slice(jsonStartIndex, jsonEndIndex + 1);
//       // console.log('slice >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ', JSON.stringify(jsonString));
//       // console.log('slice but parse ', fmt2json(jsonString));
//       // const parseJSONData = fmt2json(jsonString); //JSON.parse(jsonString);

//       // const objectPath = FindObjectPath(parseJSONData, 'result');

//       // const extractedJSONData =
//       //   objectPath.length > 0
//       //     ? objectPath.reduce((pv, cv) => {
//       //         if (pv) {
//       //           return pv[cv];
//       //         }
//       //         return parseJSONData[cv];
//       //       }, null)
//       //     : parseJSONData;
//       // return extractedJSONData;
//     }
//     throw new Error(JSON.stringify(chatCompletion));
//   } catch (error) {
//     console.log('OpenAITaskPrompt Error: ', error, JSON.stringify(error?.response, null, 2));
//     // throw new Error(error);
//     return null;
//   }
// };

export const OpenAITaskPrompt = async (promptQuery: string): Promise<ChatCompletionMessage> => {
  try {
    const openai = new OpenAI({
      // baseURL: 'https://api.deepseek.com',
      // apiKey: //process.env.OPEN_AI_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPEN_ROUTER_AI_KEY, // process.env.OPEN_ROUTER_AI_KEY
      defaultHeaders: {
        'HTTP-Referer': 'https://app.upenglishvietnam.com', // Optional. Site URL for rankings on openrouter.ai.
        'X-Title': 'UP English', // Optional. Site title for rankings on openrouter.ai.
      },
    });

    console.log('promptQuery >>>>>>>>>> ', promptQuery);

    const chatCompletion = await openai.chat.completions.create({
      model: 'google/gemini-2.5-flash-preview-05-20:thinking', // 'google/gemini-2.5-pro-preview',
      messages: [
        //         {
        //           role: 'system',
        //           content: `You are a JSON-only API. Only respond with a valid JSON object that matches the schema:
        // {
        //   "correctAnswerPoints": string,
        //   "correct": boolean,
        //   "reason": string
        // }
        // Do not add any commentary or formatting outside of the JSON object.`,
        //         },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptQuery,
            },
          ],
        },
      ],
      response_format: {
        type: 'json_object',
      },
      //   json_schema: {
      //     name: 'answerTask',
      //     strict: true,
      //     schema: {
      //       type: 'object',
      //       properties: {
      //         correctAnswerPoints: {
      //           type: 'string',
      //         },
      //         correct: {
      //           type: 'boolean',
      //         },
      //         reason: {
      //           type: 'string',
      //         },
      //       },
      //       required: ['correctAnswerPoints', 'correct', 'reason'],
      //       additionalProperties: false,
      //     },
      //   },
      // } as any,
    });

    console.log('chatCompletion', JSON.stringify(chatCompletion));
    //   console.log('openAIResponse.data.choices >>>>>>>>> ', openAIResponse?.data?.choices);

    if (chatCompletion.choices.length > 0) {
      const choice = chatCompletion.choices[0].message;
      console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
      console.log('choice ', JSON.stringify(choice, null, 2));

      /* extract the json data */
      const content = chatCompletion.choices[0].message.content.match(/\{[\s\S]*?\}/);
      chatCompletion.choices[0].message.content = content[0];

      return choice;

      // const jsonStartIndex = choice.indexOf('{');
      // const jsonEndIndex = choice.lastIndexOf('}');
      // const jsonString = choice.slice(jsonStartIndex, jsonEndIndex + 1);
      // console.log('slice >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ', JSON.stringify(jsonString));
      // console.log('slice but parse ', fmt2json(jsonString));
      // const parseJSONData = fmt2json(jsonString); //JSON.parse(jsonString);

      // const objectPath = FindObjectPath(parseJSONData, 'result');

      // const extractedJSONData =
      //   objectPath.length > 0
      //     ? objectPath.reduce((pv, cv) => {
      //         if (pv) {
      //           return pv[cv];
      //         }
      //         return parseJSONData[cv];
      //       }, null)
      //     : parseJSONData;
      // return extractedJSONData;
    }
    throw new Error(JSON.stringify(chatCompletion));
  } catch (error) {
    console.log('OpenAITaskPrompt Error: ', error, JSON.stringify(error?.response, null, 2));
    // throw new Error(error);
    return null;
  }
};

// export const GeminiTaskPrompt = async (promptQuery: string): Promise<{ content: string }> => {
//   try {
//     console.log('promptQuery >>>>>>>>>> ', promptQuery);

//     const ai = new GoogleGenAI({ apiKey: apiKey });
//     const result = await ai.models.generateContent({
//       model: 'gemini-2.0-flash',
//       contents: promptQuery,
//       config: {
//         responseMimeType: 'application/json',
//         // responseSchema: {
//         //   type: Type.ARRAY,
//         //   items: {
//         //     type: Type.OBJECT,
//         //     properties: {
//         //       recipeName: {
//         //         type: Type.STRING,
//         //         description: 'Name of the recipe',
//         //         nullable: false,
//         //       },
//         //     },
//         //     required: ['recipeName'],
//         //   },
//         // },
//       },
//     });
//     // .then((res) => {
//     //   console.log('generateContent>>>>>>>>>>>>', res.text);
//     // })
//     // .catch((err) => {
//     //   console.log('err>>>>>>>>>>>>', err);
//     // });

//     // const genAI = new GoogleGenerativeAI(apiKey);
//     // const model = genAI.getGenerativeModel({
//     //   model: 'gemini-2.0-flash',
//     //   toolConfig:{}
//     // });

//     // // const generationConfig = {
//     // //   temperature: 1,
//     // //   topP: 0.95,
//     // //   topK: 64,
//     // //   maxOutputTokens: 65536,
//     // //   responseModalities: [],
//     // //   responseMimeType: 'application/json',
//     // // };

//     // model
//     //   .generateContent(promptQuery)
//     //   .then((res) => {
//     //     console.log('generateContent>>>>>>>>>>>>', res.response.text());
//     //   })
//     //   .catch((err) => {
//     //     console.log('err>>>>>>>>>>>>', err);
//     //   });

//     /////////

//     // const openai = new OpenAI({
//     //   apiKey: process.env.OPEN_AI_KEY,
//     // });

//     // const chatCompletion = await openai.chat.completions.create({
//     //   model: 'gpt-4o-2024-08-06',
//     //   messages: [{ role: 'user', content: promptQuery }],
//     //   response_format: {
//     //     type: 'json_object',
//     //   },
//     //   //   temperature: 0.9,
//     //   //   top_p: 1,
//     //   //   max_tokens: 2000,
//     //   //   frequency_penalty: 0,
//     //   //   presence_penalty: 0.6,
//     //   //   stop: [' Human:', ' AI:'],
//     // });
//     // // .catch(() => null);

//     // console.log(chatCompletion.choices);
//     // //   console.log('openAIResponse.data.choices >>>>>>>>> ', openAIResponse?.data?.choices);

//     // if (chatCompletion.choices.length > 0) {
//     //   const choice = chatCompletion.choices[0].message;
//     //   console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
//     //   console.log('choice ', JSON.stringify(choice, null, 2));

//     //   return choice;
//     return { content: result.text };

//     //   // const jsonStartIndex = choice.indexOf('{');
//     //   // const jsonEndIndex = choice.lastIndexOf('}');
//     //   // const jsonString = choice.slice(jsonStartIndex, jsonEndIndex + 1);
//     //   // console.log('slice >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> ', JSON.stringify(jsonString));
//     //   // console.log('slice but parse ', fmt2json(jsonString));
//     //   // const parseJSONData = fmt2json(jsonString); //JSON.parse(jsonString);

//     //   // const objectPath = FindObjectPath(parseJSONData, 'result');

//     //   // const extractedJSONData =
//     //   //   objectPath.length > 0
//     //   //     ? objectPath.reduce((pv, cv) => {
//     //   //         if (pv) {
//     //   //           return pv[cv];
//     //   //         }
//     //   //         return parseJSONData[cv];
//     //   //       }, null)
//     //   //     : parseJSONData;
//     //   // return extractedJSONData;
//     // }
//     // throw new Error(JSON.stringify(chatCompletion));
//   } catch (error) {
//     console.log('OpenAITaskPrompt Error: ', error, JSON.stringify(error?.response, null, 2));
//     // throw new Error(error);
//     return null;
//   }
// };

export const SuperLMSAIPrompt = async (
  promptQuery: string,
  prompt: IELTSPrompts
): Promise<{
  score: number;
  feedback: string;
  taskResponseBand: number;
  coherenceCohesionBand: number;
  lexicalResourceBand: number;
  grammarBand: number;
}> => {
  try {
    // const openai = new OpenAI({
    //   baseURL: 'https://openrouter.ai/api/v1',
    //   apiKey: // process.env.OPEN_ROUTER_AI_KEY
    //   defaultHeaders: {
    //     'HTTP-Referer': 'https://app.upenglishvietnam.com',
    //     'X-Title': 'UP English',
    //   },
    // });

    // const chatCompletion = await openai.chat.completions.create({
    //   model: 'google/gemini-3-flash-preview',
    //   messages: [
    //     {
    //       role: 'user',
    //       content: [
    //         {
    //           type: 'text',
    //           text: promptQuery,
    //         },
    //       ],
    //     },
    //   ],
    //   response_format: {
    //     type: 'json_object',
    //   },
    // });

    // console.log('chatCompletion', JSON.stringify(chatCompletion));

    // if (chatCompletion.choices.length > 0) {
    //   const choice = chatCompletion.choices[0].message;
    //   console.log('choices ', JSON.stringify(chatCompletion.choices, null, 2));
    //   console.log('choice ', JSON.stringify(choice, null, 2));

    //   /* extract the json data */
    //   const content = chatCompletion.choices[0].message.content.match(/\{[\s\S]*?\}/);
    //   chatCompletion.choices[0].message.content = content[0];

    //   return choice;
    // }
    // throw new Error(JSON.stringify(chatCompletion));

    if (prompt.provider === 'openrouter') {
      const openRouter = new OpenRouter({
        apiKey: prompt.apiKey,
      });

      const chatCompletion = await openRouter.chat.send({
        model: prompt.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: promptQuery,
              },
            ],
          },
        ],
      });

      console.log('openrouter writing response', chatCompletion);

      if (chatCompletion.choices.length > 0) {
        const choice = chatCompletion.choices[0].message;
        const responseContent = JSON.parse(choice.content as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }
      return null;
    }

    if (prompt.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: prompt.apiKey });

      const response = await ai.models.generateContent({
        model: prompt.apiKey,
        contents: [
          {
            text: promptQuery,
          },
        ],
      });

      console.log('GoogleGenAI ', response.text);

      if (response.text) {
        const responseContent = JSON.parse(response.text as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }
      return null;
    }

    if (prompt.provider === 'openai') {
      const openai = new OpenAI({
        apiKey: prompt.apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://app.upenglishvietnam.com',
          'X-Title': 'UP English',
        },
      });

      const chatCompletion = await openai.chat.completions.create({
        model: prompt.model,
        messages: [
          {
            role: 'user',
            content: [
              // 📝 USER INTENT
              {
                type: 'text',
                text: promptQuery,
              },
            ],
          },
        ],
      });

      console.log('chatCompletion', chatCompletion);

      if (chatCompletion.choices.length > 0) {
        const choice = chatCompletion.choices[0].message;
        const responseContent = JSON.parse(choice.content as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }
      return null;
    }

    return null;
  } catch (error) {
    console.log('SuperLMSAIPrompt Error: ', error, JSON.stringify(error?.response, null, 2));
    return null;
  }
};

export const SuperLMSAIPromptSpeaking = async (
  promptQuery: string,
  teacherAudio: string,
  studentAudio: string,
  prompt: IELTSPrompts
): Promise<{
  score: number;
  feedback: string;
  taskResponseBand: number;
  coherenceCohesionBand: number;
  lexicalResourceBand: number;
  grammarBand: number;
}> => {
  try {
    if (prompt.provider === 'openrouter') {
      const openRouter = new OpenRouter({
        apiKey: prompt.apiKey,
      });

      const chatCompletion = await openRouter.chat.send({
        model: prompt.model,
        messages: [
          {
            role: 'user',
            content: [
              // ✅ AUDIO INPUT (REQUIRED)
              {
                type: 'input_audio',
                inputAudio: {
                  data: teacherAudio, // base64 string ONLY (no data: prefix)
                  format: 'webm', // webm | wav | mp3
                },
              },

              // ✅ AUDIO INPUT (REQUIRED)
              {
                type: 'input_audio',
                inputAudio: {
                  data: studentAudio, // base64 string ONLY (no data: prefix)
                  format: 'webm', // webm | wav | mp3
                },
              },

              // 📝 USER INTENT
              {
                type: 'text',
                text: promptQuery,
              },
            ],
          },
        ],
      });

      console.log('chatCompletion', chatCompletion);

      if (chatCompletion.choices.length > 0) {
        const choice = chatCompletion.choices[0].message;
        const responseContent = JSON.parse(choice.content as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }
      return null;
    }

    if (prompt.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: prompt.apiKey });

      const response = await ai.models.generateContent({
        model: prompt.apiKey,
        contents: [
          {
            inlineData: {
              mimeType: 'audio/mp3',
              data: teacherAudio,
            },
          },
          {
            inlineData: {
              mimeType: 'audio/wav',
              data: studentAudio,
            },
          },
          // 📝 USER INTENT
          {
            text: promptQuery,
          },
        ],
      });

      console.log('GoogleGenAI ', response.text);

      if (response.text) {
        const responseContent = JSON.parse(response.text as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }
      return null;
    }

    if (prompt.provider === 'openai') {
      const openai = new OpenAI({
        apiKey: prompt.apiKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://app.upenglishvietnam.com',
          'X-Title': 'UP English',
        },
      });

      const chatCompletion = await openai.chat.completions.create({
        model: prompt.model,
        modalities: ['text', 'audio'],
        messages: [
          {
            role: 'user',
            content: [
              // ✅ AUDIO INPUT (REQUIRED)
              {
                type: 'input_audio',
                input_audio: {
                  data: teacherAudio, // base64 string ONLY (no data: prefix)
                  format: 'wav', // webm | wav | mp3
                },
              },

              // ✅ AUDIO INPUT (REQUIRED)
              {
                type: 'input_audio',
                input_audio: {
                  data: studentAudio, // base64 string ONLY (no data: prefix)
                  format: 'wav', // webm | wav | mp3
                },
              },

              // 📝 USER INTENT
              {
                type: 'text',
                text: promptQuery,
              },
            ],
          },
        ],
      });

      console.log('chatCompletion', chatCompletion);

      if (chatCompletion.choices.length > 0) {
        const choice = chatCompletion.choices[0].message;
        const responseContent = JSON.parse(choice.content as string) as {
          score: number;
          feedback: string;
          taskResponseBand: number;
          coherenceCohesionBand: number;
          lexicalResourceBand: number;
          grammarBand: number;
        };

        return responseContent;
      }

      return null;
    }

    return null;
  } catch (error) {
    console.log('SuperLMSAIPromptSpeaking Error: ', error, JSON.stringify(error?.response, null, 2));
    return null;
  }
};

export const SuperLMSPromptComposer = (params: {
  essay: string;
  question: string;
  studentAnswer: string;
  originalAnswer: string;
  scoreRangeFrom: number;
  scoreRangeTo: number;
  prompt: string;
}) => {
  const prompt = `You are an expert English examiner. Your task is to evaluate a student's answer based on the provided essay, question, and correct answer.

Follow this structure:

1. ESSAY:
${params.essay}

2. QUESTION:
${params.question}

3. STUDENT ANSWER:
${params.studentAnswer}

4. ORIGINAL ANSWER (Correct Answer):
${params.originalAnswer}

--------------------------------

### Evaluation Instructions

${params.prompt}

You must evaluate using these criteria:

- **Score (${params.scoreRangeFrom}–${params.scoreRangeTo})** — overall correctness based on how accurately the student answered the question.
- **Task Response (Band 1–9)** — how fully the student answered the question.
- **Coherence & Cohesion (Band 1–9)** — clarity, organization, and logical flow.
- **Lexical Resource (Band 1–9)** — vocabulary accuracy and appropriateness.
- **Grammatical Range & Accuracy (Band 1–9)** — grammar correctness and variety.
- **AI Feedback** — short, clear feedback for the student.

--------------------------------

### Output Format
Return ONLY valid JSON using the following structure:

{
  "score": <number between ${params.scoreRangeFrom} and ${params.scoreRangeTo}>,
  "taskResponseBand": <1-9>,
  "coherenceCohesionBand": <1-9>,
  "lexicalResourceBand": <1-9>,
  "grammarBand": <1-9>,
  "feedback": "<short constructive feedback>"
}

DO NOT include any text outside the JSON.
`;

  return prompt;
};

export const SuperLMSPromptComposerSpeaking = (params: { originalAnswer: string; scoreRangeFrom: number; scoreRangeTo: number; prompt: string }) => {
  const prompt = `You are an expert Linguistic Coach evaluating a student with English Level: B1.

ORIGINAL ANSWER (Correct Answer):
${params.originalAnswer}

${params.prompt}

--------------------------------

### Output Format
Return ONLY valid JSON using the following structure:

{
  "score": <number between ${params.scoreRangeFrom} and ${params.scoreRangeTo}>,
  "taskResponseBand": <1-9>,
  "coherenceCohesionBand": <1-9>,
  "lexicalResourceBand": <1-9>,
  "grammarBand": <1-9>,
  "feedback": "<short constructive feedback>"
}

DO NOT include any text outside the JSON.
`;

  return prompt;
};
