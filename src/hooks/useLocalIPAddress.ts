import { useState, useEffect } from 'react';

const fetchLocalIP = async (): Promise<string> => {
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');

    return new Promise((resolve) => {
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          const match = candidate.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
          if (match && match[1] !== '127.0.0.1') {
            pc.close();
            resolve(match[1]);
          }
        }
      };

      pc.createOffer().then((offer) => pc.setLocalDescription(offer));

      setTimeout(() => {
        pc.close();
        resolve(window.location.hostname || 'localhost');
      }, 5000);
    });
  } catch {
    return window.location.hostname || 'localhost';
  }
};

export const useLocalIPAddress = (): string => {
  const [ip, setIp] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchLocalIP().then((addr) => {
      if (isMounted) setIp(addr);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return ip;
};
