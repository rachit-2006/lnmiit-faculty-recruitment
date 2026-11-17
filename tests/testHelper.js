// Automated Test Helper for In-Memory Request Dispatching
const { Readable } = require('stream');
const http = require('http');
const app = require('../server');
const db = require('../src/db/db');

/**
 * Dispatches an HTTP request directly to the Express application pipeline
 * without requiring network socket binding, perfectly sandboxed and fast.
 */
function request(options) {
  const {
    method = 'GET',
    url = '/',
    headers = {},
    body = null,
    token = null
  } = options;

  return new Promise((resolve, reject) => {
    const socket = new Readable({ read() {} });
    socket.encrypted = false;
    socket.remoteAddress = '127.0.0.1';
    socket.address = () => ({ address: '127.0.0.1', port: 12345 });
    socket.destroy = () => {};

    const req = new http.IncomingMessage(socket);
    req.method = method.toUpperCase();
    req.url = url;
    req.originalUrl = url;

    const lowerHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      lowerHeaders[k.toLowerCase()] = v;
    }
    if (token) {
      lowerHeaders['authorization'] = `Bearer ${token}`;
    }

    let payload = null;
    if (body) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        payload = JSON.stringify(body);
        if (!lowerHeaders['content-type']) {
          lowerHeaders['content-type'] = 'application/json';
        }
      } else {
        payload = body;
      }
      lowerHeaders['content-length'] = Buffer.byteLength(payload).toString();
    }

    req.headers = lowerHeaders;

    // Push body to readable stream
    if (payload) {
      req.push(payload);
    }
    req.push(null);

    const res = new http.ServerResponse(req);
    res.assignSocket(socket);
    const chunks = [];

    res.write = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = function (chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      res.finished = true;
      res.emit('finish');

      const rawBody = Buffer.concat(chunks).toString('utf8');
      let data = {};
      try {
        data = JSON.parse(rawBody);
      } catch (e) {
        data = rawBody;
      }

      resolve({
        status: res.statusCode,
        headers: res.getHeaders(),
        data,
        body: rawBody
      });
    };

    try {
      app(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Standard test credentials
 */
const CREDENTIALS = {
  APPLICANT: { email: 'rahul.sharma@example.com', password: 'Applicant@123' },
  RECRUITMENT_CELL: { email: 'anita.verma@lnmiit.ac.in', password: 'Recruiter@123' },
  INTERVIEW_PANEL_1: { email: 'k.iyer@lnmiit.ac.in', password: 'Panel@123' },
  INTERVIEW_PANEL_2: { email: 's.bansal@lnmiit.ac.in', password: 'Panel@123' },
  HOD_CSE: { email: 'hod.cse@lnmiit.ac.in', password: 'Hod@123' },
  ADMINISTRATOR: { email: 'admin@lnmiit.ac.in', password: 'Admin@123' }
};

/**
 * Helper to obtain a valid session token for a given role
 */
async function loginAs(roleKey) {
  const creds = CREDENTIALS[roleKey];
  if (!creds) throw new Error(`Unknown test role: ${roleKey}`);
  const res = await request({
    method: 'POST',
    url: '/api/auth/login',
    body: creds
  });
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Failed to login as ${roleKey}: ${JSON.stringify(res.data)}`);
  }
  return {
    token: res.data.token,
    user: res.data.user || res.data
  };
}

module.exports = {
  app,
  db,
  request,
  CREDENTIALS,
  loginAs
};
