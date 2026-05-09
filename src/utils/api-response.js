const sendSuccess = (res, statusCode, payload = {}) => {
    return res.status(statusCode).json({
        success: true,
        ...payload,
    })
}

const sendError = (res, statusCode, code, message, details) => {
    const errorPayload = {
        success: false,
        error: {
            code,
            message,
        },
    }

    if (details !== undefined) {
        errorPayload.error.details = details
    }

    return res.status(statusCode).json(errorPayload)
}

module.exports = { sendSuccess, sendError }