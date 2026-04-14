// /src/hbs/chat/utils/socketRateLimiter.js

// userId -> { count, resetAt }
const rateLimitMap = new Map();

/**
 * Check karo ke user rate limited hai ya nahi
 * @param {string} userId
 * @param {number} maxRequests - per window max messages (default: 30)
 * @param {number} windowMs - window size in ms (default: 60 seconds)
 * @returns {boolean} true = rate limited (block karo), false = allow karo
 */
function isRateLimited(userId, maxRequests = 30, windowMs = 60000) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  // Pehli baar ya window expire ho gayi
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return false;
  }

  // Limit exceed ho gayi
  if (userLimit.count >= maxRequests) {
    return true;
  }

  // Count badhao
  userLimit.count++;
  return false;
}

// Memory leak prevent karne ke liye har 5 minute mein cleanup
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of rateLimitMap.entries()) {
    if (now > data.resetAt) {
      rateLimitMap.delete(userId);
    }
  }
}, 5 * 60 * 1000);

module.exports = { isRateLimited };