export class WebRTCClient {
  constructor() {
    this.peerConnection = null
    this.dataChannel = null
    this.onMessage = null
    this.onOpen = null
    this.onClose = null
  }

  generateShortCode(length = 6) {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += characters
        .charAt(Math.floor(Math.random() * characters.length))
        .toUpperCase()
    }
    return result
  }

  async createOffer() {
    this.peerConnection = new RTCPeerConnection()
    this.dataChannel = this.peerConnection.createDataChannel('dataChannel')
    this.dataChannel.onopen = () => {
      if (this.onOpen) this.onOpen()
    }
    this.dataChannel.onmessage = (e) => {
      if (this.onMessage) this.onMessage(e.data)
    }
    this.dataChannel.onclose = () => {
      if (this.onClose) this.onClose()
    }

    const offer = await this.peerConnection.createOffer()
    await this.peerConnection.setLocalDescription(offer)

    const shortCode = this.generateShortCode()
    return { offer, shortCode }
  }

  async createAnswer(offer) {
    this.peerConnection = new RTCPeerConnection()
    this.peerConnection.ondatachannel = (e) => {
      this.dataChannel = e.channel
      this.dataChannel.onopen = () => {
        if (this.onOpen) this.onOpen()
      }
      this.dataChannel.onmessage = (e) => {
        if (this.onMessage) this.onMessage(e.data)
        console.log('e.data', e?.data)
      }
      this.dataChannel.onclose = () => {
        if (this.onClose) this.onClose()
      }
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(offer)
    )
    const answer = await this.peerConnection.createAnswer()
    await this.peerConnection.setLocalDescription(answer)

    return answer
  }

  async handleAnswer(answer) {
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(answer)
    )
  }
}
