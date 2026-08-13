/**
 * WebRTC SDP Munging Utility for WhatsApp Calling Protocol
 * Spec: 06-REALTIME-WEBRTC-SPEC.md §4.3 & 09-TESTING-STRATEGY.md §5.7
 */

export function keepOnlyCodecs(sdp: string, allowedCodecs: string[]): string {
  const lines = sdp.split(/\r?\n/);
  const resultLines: string[] = [];

  let inAudio = false;
  let audioPayloadTypes: string[] = [];
  const keptPayloadTypes = new Set<string>();

  // First pass: find payload types for allowed codecs
  for (const line of lines) {
    if (line.startsWith('m=audio')) {
      inAudio = true;
    } else if (line.startsWith('m=')) {
      inAudio = false;
    }

    if (inAudio && line.startsWith('a=rtpmap:')) {
      // e.g. a=rtpmap:111 opus/48000/2
      const match = line.match(/^a=rtpmap:(\d+)\s+([^\r\n]+)/);
      if (match) {
        const pt = match[1]!;
        const codecSpec = match[2]!.toLowerCase();
        for (const allowed of allowedCodecs) {
          if (codecSpec.startsWith(allowed.toLowerCase())) {
            keptPayloadTypes.add(pt);
          }
        }
      }
    }
  }

  // Second pass: filter m=audio line and a=rtpmap/fmtp lines
  inAudio = false;
  for (const line of lines) {
    if (line.startsWith('m=audio')) {
      inAudio = true;
      const parts = line.split(' ');
      const header = parts.slice(0, 3);
      audioPayloadTypes = parts.slice(3);

      const filteredPts = audioPayloadTypes.filter((pt) => keptPayloadTypes.has(pt));
      resultLines.push([...header, ...(filteredPts.length > 0 ? filteredPts : audioPayloadTypes)].join(' '));
      continue;
    } else if (line.startsWith('m=')) {
      inAudio = false;
    }

    if (inAudio && (line.startsWith('a=rtpmap:') || line.startsWith('a=fmtp:'))) {
      const match = line.match(/^a=(?:rtpmap|fmtp):(\d+)/);
      if (match) {
        const pt = match[1]!;
        if (!keptPayloadTypes.has(pt) && keptPayloadTypes.size > 0) {
          continue; // Skip payload types not in kept set
        }
      }
    }

    resultLines.push(line);
  }

  return resultLines.join('\r\n');
}

export function enforceAttribute(sdp: string, mediaType: 'audio', attrName: string, attrVal: string): string {
  const lines = sdp.split(/\r?\n/);
  const resultLines: string[] = [];

  let inTargetMedia = false;
  let attrAdded = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.startsWith(`m=${mediaType}`)) {
      inTargetMedia = true;
      resultLines.push(line);
      continue;
    } else if (line.startsWith('m=')) {
      if (inTargetMedia && !attrAdded) {
        resultLines.push(`a=${attrName}:${attrVal}`);
        attrAdded = true;
      }
      inTargetMedia = false;
    }

    if (inTargetMedia && line.startsWith(`a=${attrName}:`)) {
      resultLines.push(`a=${attrName}:${attrVal}`);
      attrAdded = true;
      continue;
    }

    resultLines.push(line);
  }

  if (inTargetMedia && !attrAdded) {
    resultLines.push(`a=${attrName}:${attrVal}`);
  }

  return resultLines.join('\r\n');
}

export function setOpusFmtp(
  sdp: string,
  params: { useinbandfec?: number; usedtx?: number; stereo?: number; maxaveragebitrate?: number }
): string {
  const lines = sdp.split(/\r?\n/);
  let opusPt: string | null = null;

  // Find Opus Payload Type
  for (const line of lines) {
    if (line.startsWith('a=rtpmap:')) {
      const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000/i);
      if (match) {
        opusPt = match[1]!;
        break;
      }
    }
  }

  if (!opusPt) return sdp;

  const fmtpString = `useinbandfec=${params.useinbandfec ?? 1};usedtx=${params.usedtx ?? 0};stereo=${params.stereo ?? 0};maxaveragebitrate=${params.maxaveragebitrate ?? 32000}`;

  const resultLines: string[] = [];
  let fmtpFound = false;

  for (const line of lines) {
    if (line.startsWith(`a=fmtp:${opusPt}`)) {
      resultLines.push(`a=fmtp:${opusPt} ${fmtpString}`);
      fmtpFound = true;
    } else {
      resultLines.push(line);
    }
  }

  if (!fmtpFound) {
    // Insert after a=rtpmap line for opus
    const finalLines: string[] = [];
    for (const line of resultLines) {
      finalLines.push(line);
      if (line.startsWith(`a=rtpmap:${opusPt}`)) {
        finalLines.push(`a=fmtp:${opusPt} ${fmtpString}`);
      }
    }
    return finalLines.join('\r\n');
  }

  return resultLines.join('\r\n');
}

export function mungeSdp(sdp: string): string {
  if (!sdp) return sdp;
  let out = sdp;
  // 1) Keep only Opus and telephone-event on m=audio
  out = keepOnlyCodecs(out, ['opus/48000', 'telephone-event/8000']);
  // 2) Force ptime 20 ms & maxptime 20 ms
  out = enforceAttribute(out, 'audio', 'ptime', '20');
  out = enforceAttribute(out, 'audio', 'maxptime', '20');
  // 3) Set Opus fmtp params
  out = setOpusFmtp(out, { useinbandfec: 1, usedtx: 0, stereo: 0, maxaveragebitrate: 32000 });
  return out;
}
