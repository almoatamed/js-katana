import { appIdentityConfig } from "../../config/appIdentity/index.js";
import { hostingConfig } from "../../config/hosting/index.js";
import { multithreadingConfig } from "../../config/multithreading/index.js";
interface MessageContentOptions {
    title?: String;
    subtitle?: String;
    text?: String;
}

interface EmailGenerateOptions {
    title?: String;
    subtitle?: String;
    direction?: "ltr" | "rtl";
    content?: MessageContentOptions[];
    endingMessage?: String;
    appUrl?: String;
    appName?: String;
    clientName?: String;
    clientLogo?: String;
    ourName?: String;
    ourLogo?: String;
}

const render = multithreadingConfig.workerRenderEngine()
    ? (await import("$/server/utils/renderEngine/proxy/index.js")).default
    : (await import("$/server/utils/renderEngine/index.js")).default;

class EmailGenerator {
    templateName = "email";
    loadImagesAsUrls = true;
    appName = appIdentityConfig.getName();
    appUrl = `http://${hostingConfig.getServerName()}`;
    clientLogo = appIdentityConfig.getLogoUrl();
    clientName = appIdentityConfig.getName();
    ourLogo = appIdentityConfig.getLogo();
    ourName = appIdentityConfig.getName();
    save = null;

    /**
     * @param {EmailGenerateOptions} options placement under public
     * @returns {Promise<import("$/server/utils/renderEngine/index.js").RenderedDocumentSkeleton>}
     */
    async generateDocument(
        options: EmailGenerateOptions,
    ): Promise<import("$/server/utils/renderEngine/index.js").RenderedDocumentSkeleton> {
        const skeleton = await this.generateSkeleton(options);
        const Document = await render(skeleton);

        return Document;
    }

    generateSkeleton(
        options: EmailGenerateOptions,
    ): import("$/server/utils/renderEngine/index.js").DocumentSkeleton {
        const Document: import("$/server/utils/renderEngine/index.js").DocumentSkeleton = {
            dontRespond: false, 
            content: [
                {
                    type: "email",
                    title: options.title,
                    subtitle: options.subtitle,
                    direction: options.direction,
                    content: options.content,
                    endingMessage: options.endingMessage,
                    appUrl: options.appUrl || this.appUrl,
                    appName: options.appName || this.appName,
                    clientLogo: options.clientLogo || this.clientLogo,
                    clientName: options.clientName || this.clientName,
                    ourLogo: options.ourLogo || this.ourLogo,
                    ourName: options.ourName || this.ourName,
                },
            ],
            data: {},
            save: this.save as any,
            style: {
                paper: "A4", 
                loadImages: true,
                loadCss: true,
                wrap: true,
                loadImagesAsUrls: this.loadImagesAsUrls,
            },
            template: {
                name: this.templateName,
            },
        };
        return Document;
    }
}

export { EmailGenerator };
