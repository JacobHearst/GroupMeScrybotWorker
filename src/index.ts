import Bot from './bot'

export interface Env {
	BOT_ID: string
	ACCESS_TOKEN: string
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const json: any = await request.json()
		
		const bot = new Bot(env.BOT_ID, env.ACCESS_TOKEN)
		await bot.handle(json.text)

		return new Response()
	}
}
