// MediaMTX's official WebRTC/WHEP browser reader, adapted from MediaMTX's
// internal/servers/webrtc/reader.js for use as a local frontend module.
export class MediaMTXWebRTCReader {
  constructor(conf) {
    this.conf = conf;
    this.pc = new RTCPeerConnection({ iceServers: conf.iceServers ?? [] });
    this.closed = false;
    this.onError = conf.onError ?? (() => {});
    this.pc.ontrack = (evt) => conf.onTrack?.(evt);
    this.pc.onicecandidate = (evt) => {
      if (evt.candidate) return;
      this._start();
    };
    this.pc.addTransceiver("video", { direction: "recvonly" });
    this.pc.addTransceiver("audio", { direction: "recvonly" });
    this.pc.createOffer().then((offer) => this.pc.setLocalDescription(offer)).catch((err) => this.onError(err));
  }

  async _start() {
    if (this.closed) return;
    try {
      const offer = this.pc.localDescription?.sdp;
      if (!offer) throw new Error("WebRTC offer was not created.");
      const headers = { "Content-Type": "application/sdp" };
      if (this.conf.token) headers.Authorization = `Bearer ${this.conf.token}`;
      else if (this.conf.user) headers.Authorization = `Basic ${btoa(`${this.conf.user}:${this.conf.pass ?? ""}`)}`;
      const response = await fetch(this.conf.url, { method: "POST", headers, body: offer });
      if (!response.ok) throw new Error(`MediaMTX WebRTC returned ${response.status}`);
      const answer = await response.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });
    } catch (err) {
      if (!this.closed) this.onError(err instanceof Error ? err.message : err);
    }
  }

  close() {
    this.closed = true;
    this.pc.close();
  }
}
