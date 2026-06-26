const request = require('supertest');
const { authenticator } = require('otplib');
const app = require('../src/index');
const { users, resetLoginAttempts, resetOtpAttempts } = require('../src/utils/store');

const studentEmail = 'student@portal.edu';
const adminEmail = 'admin@portal.edu';
const mfaEmail = 'mfa@portal.edu';
const wrongPassword = 'WrongPassword!123';
const studentPassword = 'Student@Portal2024!';
const adminPassword = 'Admin@Portal2024!';
const mfaPassword = 'MfaUser@2026!';
let agent;
let csrfToken;

const postAuth = payload => agent
  .post('/api/auth/login')
  .set('x-csrf-token', csrfToken)
  .send(payload);

const postVerifyMfa = payload => agent
  .post('/api/auth/verify-mfa')
  .set('x-csrf-token', csrfToken)
  .send(payload);

const postLogout = token => agent
  .post('/api/auth/logout')
  .set('Authorization', `Bearer ${token}`)
  .set('x-csrf-token', csrfToken)
  .send({});

beforeAll(async () => {
  agent = request.agent(app);
  const csrfRes = await agent.get('/api/csrf-token');
  csrfToken = csrfRes.body.csrfToken;

  const student = users.get(studentEmail);
  const admin = users.get(adminEmail);
  const mfaUser = users.get(mfaEmail);

  expect(student).toBeDefined();
  expect(admin).toBeDefined();
  expect(mfaUser).toBeDefined();
  expect(mfaUser.mfaEnabled).toBe(true);
});

describe('Security test checklist', () => {
  afterEach(() => {
    resetLoginAttempts(studentEmail);
    resetLoginAttempts(adminEmail);
  });

  it('rejects invalid login credentials without revealing whether user exists', async () => {
    const res1 = await postAuth({ email: 'unknown@example.com', password: 'Password!23' });
    const res2 = await postAuth({ email: studentEmail, password: wrongPassword });

    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res1.body.error).toEqual(expect.stringContaining('Invalid email or password.'));
    expect(res2.body.error).toEqual(expect.stringContaining('Invalid email or password.'));
  });

  it('locks out account after repeated failed login attempts', async () => {
    resetLoginAttempts(studentEmail);

    for (let i = 0; i < 5; i += 1) {
      const res = await postAuth({ email: studentEmail, password: wrongPassword });
      if (i < 4) {
        expect(res.status).toBe(401);
        expect(res.body.attemptsRemaining).toBe(4 - i);
      } else {
        expect(res.status).toBe(429);
        expect(res.body.locked).toBe(true);
      }
    }
  });

  it('locks account A without affecting account B', async () => {
    resetLoginAttempts(studentEmail);
    resetLoginAttempts(adminEmail);

    for (let i = 0; i < 5; i += 1) {
      await postAuth({ email: studentEmail, password: wrongPassword });
    }

    const adminRes = await postAuth({ email: adminEmail, password: adminPassword });
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.token).toBeDefined();
  });

  it('rejects student access to admin logs', async () => {
    const loginRes = await postAuth({ email: studentEmail, password: studentPassword });
    expect(loginRes.body.token).toBeDefined();

    const res = await agent
      .get('/api/admin/logs')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Access denied/);
  });

  it('enforces session token expiration when issuedAt is stale', async () => {
    const jwt = require('jsonwebtoken');
    const user = users.get(studentEmail);
    const staleToken = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      mfaEnabled: false,
      issuedAt: Date.now() - 31 * 60 * 1000,
    }, process.env.JWT_SECRET || 'dev-secret-change-in-production', { expiresIn: '1h' });

    const res = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${staleToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session expired/);
  });

  it('protects CSRF-required logout without token', async () => {
    const loginRes = await postAuth({ email: adminEmail, password: adminPassword });
    const token = loginRes.body.token;

    const res = await agent
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid CSRF token/);
  });

  it('does not return password fields in login response', async () => {
    const res = await postAuth({ email: studentEmail, password: studentPassword });
    expect(res.body.user).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('requires MFA to complete login and does not expose OTP values', async () => {
    const loginRes = await postAuth({ email: mfaEmail, password: mfaPassword });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.requiresMfa).toBe(true);
    expect(loginRes.body.token).toBeUndefined();
    expect(loginRes.body.tempToken).toBeDefined();
    expect(loginRes.body.error).toBeUndefined();
    expect(loginRes.body.code).toBeUndefined();

    const secret = users.get(mfaEmail).mfaSecret;
    const validCode = authenticator.generate(secret);

    const verifyRes = await postVerifyMfa({ tempToken: loginRes.body.tempToken, code: validCode });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.token).toBeDefined();
    expect(verifyRes.body.code).toBeUndefined();

    const replayRes = await postVerifyMfa({ tempToken: loginRes.body.tempToken, code: validCode });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toMatch(/MFA session expired/);
  });

  it('enforces OTP lockout after repeated invalid attempts', async () => {
    const loginRes = await postAuth({ email: mfaEmail, password: mfaPassword });
    const tempToken = loginRes.body.tempToken;

    for (let i = 0; i < 5; i += 1) {
      const res = await postVerifyMfa({ tempToken, code: '000000' });
      if (i < 4) {
        expect(res.status).toBe(401);
      } else {
        expect(res.status).toBe(429);
        expect(res.body.locked).toBe(true);
      }
    }
  });

  it('rejects old tokens after logout', async () => {
    const loginRes = await postAuth({ email: studentEmail, password: studentPassword });
    const token = loginRes.body.token;

    const logoutRes = await postLogout(token);
    expect(logoutRes.status).toBe(200);

    const replayRes = await request(app)
      .get('/api/student/profile')
      .set('Authorization', `Bearer ${token}`);

    expect(replayRes.status).toBe(401);
  });
});
