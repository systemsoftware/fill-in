# Fill In
Fill in the blank game built on Node.js with support for ChatGPT generated prompts.

## Demo
A demo can be found at https://fillin.coolstone.dev/

## Config
This can be found in [./config.json](https://github.com/systemsoftware/fill-in/blob/main/config.json)
- openai_key: Optional OpenAI key to use to generate prompt from ChatGPT
- Generate_prompts_from_ChatGPT: Toggle ChatGPT generated (true) or from a preset array (false).
- prompts_file: File containing preset array of prompts.
- port: Port to run app on.
- title: Project/page title.

## Dependencies
- [dubnium](https://npmjs.com/dubnium)
- [express](https://npmjs.com/express)
- [socket.io](https://npmjs.com/socket.io)
- [openai](https://npmjs.com/openai) (optional)

## License
This repository is available under the [MIT license](https://github.com/systemsoftware/fill-in/blob/main/LICENSE)
