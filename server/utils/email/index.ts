import { emailConfig } from "../../config/email/index.js";
import ObjectError from "../ObjectError/index.js";

const mailer = (await import("nodemailer")).default;
const client = (await import("../../utils/database/prisma.js")).default;

const transporter = mailer.createTransport(emailConfig);

const logUtil = await import("$/server/utils/log/index.js");
const log = await logUtil.localLogDecorator("MAILER", "white", true, "Info");

let verified = false;

async function verify() {
    if (!verified) {
        await transporter.verify();
        verified = true;
        log("mailer connected");
    }
}

async function saveMail(mail, isSent) {
    mail.status = isSent ? "sent" : "notSent";
    await client.email.create({
        data: {
            from: mail.from.address || mail.from || "",
            to: mail.to,
            cc: mail.cc,
            subject: mail.subject,
            emailText: mail.text,
            status: mail.status,
            createdByUser: !mail.useId
                ? undefined
                : {
                      connect: {
                          userId: mail.useId,
                      },
                  },
            updatedByUser: !mail.useId
                ? undefined
                : {
                      connect: {
                          userId: mail.useId,
                      },
                  },
        },
    });
    return;
}

export default {
    saveMail,
    transporter: transporter,
    /**
     *
     * sends email
     *
     * @param {Object} params
     *
     * - parameters
     *   - to // (optional, default admin email) could be string (one email), list (array) of emails
     *   - cc // (optional) same as to
     *   - subject // String
     *   - text // (optional) String
     *   - headers // (optional)
     *   - html // (optional),
     *   - userId // the creator of email
     *
     *
     * @returns {Promise}
     * returned Object has
     *   - info
     *
     *   - mail
     *     - to // list of receiver in string
     *     - cc // list of cc in string
     *     - from // {name, address}
     *     - subject
     *     - status // 1->sent, 2->not sent
     *     - text // could be undefined
     *     - headers
     *     - html // html content, could be undefined
     *     - userId // creator
     */
    send: async function (params) {
        /*
         *
         * takes input of
         *
         *
         * - params
         *   - to // list of receivers emails, default admin email in env
         *   - cc // list cc emails
         *   - subject
         *   - text
         *   - headers // email headers
         *   - html
         *   - htmlFilePath
         *   - userId // the creator of email
         *
         */
        return new Promise(async (resolve, reject) => {
            try {
                await verify();
                if (!verified) {
                    throw new ObjectError({
                        statusCode: 500,
                        msg: "Email Client Not Connected",
                    });
                }
                const mail = {
                    html: undefined as any,
                    htmlFilePath: undefined as any,
                    text: undefined as any,
                    from: params.from || {
                        address: emailConfig.userName || emailConfig.from?.address || emailConfig.from,
                        name: emailConfig.name,
                    },
                    attachments: params.attachments,
                    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
                    cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
                    subject: params.subject,
                    headers: params.headers || emailConfig.headers,
                    userId: params.userId || 1,
                };
                const cb = async (err, info) => {
                    try {
                        if (err) {
                            console.log(err);
                            await saveMail(mail, false);
                            err.mail = mail;
                            return reject(err);
                        }
                        console.log(info);
                        await saveMail(mail, true);
                        /*
                         * returned doc has
                         *   - info
                         *
                         *   - mail
                         *     - to // list of receiver in string
                         *     - cc // list of cc in string
                         *     - from // {name, address}
                         *     - subject
                         *     - status // 1->sent, 2->not sent
                         *     - text // could be undefined
                         *     - headers
                         *     - template
                         *       - name
                         *       - render
                         *     - htmlFile // could be (undefined)
                         *       - data // buffer of html content
                         *       - buffer // data buffer)
                         *       - dir // under public dir
                         *       - html // html content
                         *       - saved // boolean
                         *       - mimetype // text/html
                         *       - name // full name
                         *       - path // full path
                         *       - size // bytes)
                         *     - html // html content, could be undefined
                         *     - userId // creator
                         */
                        resolve({ info, mail });
                    } catch (error: any) {
                        log.error(error);
                        reject(error);
                    }
                };
                if (params.html) {
                    mail.html = params.html;
                    mail.htmlFilePath = params.htmlFilePath;
                    transporter.sendMail(mail, cb);
                } else {
                    mail.text = params.text;
                    transporter.sendMail(mail, cb);
                }
            } catch (error: any) {
                reject(error);
            }
        });
    },
};
