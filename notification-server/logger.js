// Production logs must not contain endpoints, subscription keys, health IDs,
// reminder times, request bodies, or raw push-provider errors.
module.exports = {
    log() {}, info() {}, debug() {}, warn() {},
    error() { console.error('[notification-server] Operation failed'); }
};
