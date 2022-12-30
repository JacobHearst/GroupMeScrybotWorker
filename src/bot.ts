import Card from "scryfall-client/dist/models/card"
import { ImageUris } from "scryfall-client/dist/types/api/constants"

export default class Bot {
    botID: string
    accessToken: string

    constructor(botID: string, accessToken: string) {
        this.botID = botID
        this.accessToken = accessToken
    }

    async handle(message: string) {
        const botRegex = /\[\[([^\[\]]+)\]\]/g
        const matches = message.match(botRegex)

        if (!matches) return

        for (let i = 0; i < matches.length; i++) {
            const name = matches[i].replace("[[", "").replace("]]", "")
            const card = await this.getCard(name)

            if (!card) continue
            await this.postCardDetails(card, name)
        }

        console.log("Finished handling message")
    }

    private async postCardDetails(card: Card, faceName: string) {
        // Upload the image
        console.log(`Uploading art for ${faceName}`)
        const url = await this.uploadCardArt(card, faceName)
        if (!url) {
            await this.postMessage({ text: `Didn't get URL for uploaded image of ${faceName}` })
            return
        }

        // Send the message
        console.log(`Posting ${faceName} to chat`)
        await this.postMessage({
            text: card.scryfall_uri,
            attachments: [
                { type: "image", url }
            ]
        })

        console.log(`Done posting ${faceName} details`)
    }

    private async uploadCardArt(card: Card, faceName: string) {
        const imageURI = this.getMultifaceCardArt(card, faceName)

        if (!imageURI) {
            await this.postMessage({ text: `Couldn't find an image for ${faceName}` })
            return
        }

        try {
            const imageResponse = await fetch(imageURI)
            const image = await imageResponse.blob()

            const options: RequestInit<RequestInitCfProperties> = {
                method: "POST",
                headers: {
                    "Content-Type": "application/jpeg",
                    "X-Access-Token": this.accessToken
                },
                body: image
            }

            const uploadResponse = await fetch("https://image.groupme.com/pictures", options)
            const json: { payload: { url: string, picture_url: string } } = await uploadResponse.json()

            return json.payload.picture_url
        } catch(error) {
            console.error(error)
            await this.postMessage({ text: `Errored trying to upload ${faceName} image to groupme` })
        }
    }

    private async getCard(name: string) {
        console.log(`Getting: ${name}`)
        try {
            const encodedName = encodeURIComponent(name)
            const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodedName}`)

            console.log("Got fetch response")

            if (response.status >= 400) {
                const error: any = await response.json()
                const text = `Scryfall request failed: ${error.details}`
                console.error(text)
                await this.postMessage({ text } )
                return
            }

            const card = await response.json() as Card
            console.log("Successfully retrieved card")
            return card
        } catch (error) {
            await this.postMessage({ text: `Errored trying to fetch ${name} from Scryfall`})
            console.error(error)
        }
    }

    private async postMessage(content: { text: string, attachments?: [ { type: string, url: string } ] }) {
        const body = {
            bot_id: this.botID,
            ...content
        }

        const options: RequestInit<RequestInitCfProperties> = {
            method: "POST",
            body: JSON.stringify(body)
        }

        const response = await fetch("https://api.groupme.com/v3/bots/post", options)
        console.log(`Message post status: ${await response.text()}`)
    }

    // Try to get the art for the specified face
    private getMultifaceCardArt(card: Card, faceName: string) {
        if (!card.card_faces && card.image_uris) {
            console.debug("Retrieving single face card art")
            return this.selectImageUri(card.image_uris)
        }

        let face = card.card_faces.find(face => face.name.toLowerCase().includes(faceName.toLowerCase()))
        if (face && face.image_uris) {
            return this.selectImageUri(face.image_uris)
        } else if (card.card_faces[0].image_uris) {
            console.warn(`Couldn't find card face with name: '${faceName}'. Showing front face`)
            return this.selectImageUri(card.card_faces[0].image_uris)
        } else {
            console.error(`Face of '${card.name}' doesn't have an image associated with it`)
            return
        }
    }

    private selectImageUri(uris: ImageUris) {
        return uris.normal || uris.large || uris.small
    }
}