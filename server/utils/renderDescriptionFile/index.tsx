import { PropsWithChildren } from "@kitajs/html";
import { readFile } from "fs/promises";
import { cap } from "kt-common";
import { renderMarkdown } from "./processMdToHtml.js";

export const Layout = ({
    title,
    children,
    additionalScripts,
    additionalHeads,
}: PropsWithChildren<{
    title: string;
    additionalScripts?: JSX.Element;
    additionalHeads?: JSX.Element;
}>) => {
    return (
        <>
            {`<!--[if lt IE 7]>      <html class="no-js lt-ie9 lt-ie8 lt-ie7"> <![endif]-->`}
            {`<!--[if IE 7]>         <html class="no-js lt-ie9 lt-ie8"> <![endif]-->`}
            {`<!--[if IE 8]>         <html class="no-js lt-ie9"> <![endif]-->`}
            {`<!--[if gt IE 8]>      <html class="no-js"> <!--<![endif]-->`}
            <html
                style={{
                    padding: "0xp",
                    margin: "0px",
                    width: "100%",
                    height: "100%",
                }}
            >
                <head>
                    <meta charset="utf-8" />
                    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
                    <title>{title}</title>
                    <meta name="description" content="" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <link rel="stylesheet" href="" />
                    {additionalHeads}
                </head>
                <body
                    style={{
                        background: "#090b10ff",
                        padding: "0xp",
                        margin: "0px",
                        width: "100%",
                        height: "100%",
                    }}
                >
                    {`<!--[if lt IE 7]>`}
                    <p class="browsehappy">
                        You are using an <strong>outdated</strong> browser. Please <a href="#">upgrade your browser</a>{" "}
                        to improve your experience.
                    </p>
                    {`<![endif]-->`}

                    <main
                        style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            padding: "0xp",
                            margin: "0px",
                        }}
                    >
                        {children}
                    </main>
                    {additionalScripts}
                </body>
            </html>
        </>
    );
};

export const View = (props: PropsWithChildren<JSX.HtmlTag>) => {
    return (
        <div
            {...props}
            style={{
                color: "#f2f6fc",
                display: "flex",
                fontFamily: "sans-serif",
                fontWeight: "700",
                flexDirection: "column",
                ...(typeof props.style == "object" ? props.style : {}),
            }}
        >
            {props.children}
        </div>
    );
};

export const Divider = () => {
    return (
        <>
            <div
                style={{
                    height: "1px",
                    backgroundColor: "#f2f6fc22",
                }}
            ></div>
        </>
    );
};

export const Card = (
    props: PropsWithChildren<JSX.HtmlTag> & {
        cardTitle?: string;
    }
) => {
    return (
        <View
            {...props}
            style={{
                background: "#0e1117",
                boxShadow: `1px 1px 15px 1px #00000022`,
                padding: "22px 16px",
                gap: "12px",
                width: "100%",
                maxWidth: "1280px",
                borderRadius: "12px",
                ...(typeof props.style == "object" ? props.style : {}),
            }}
        >
            {props.cardTitle && (
                <>
                    <View
                        style={{
                            fontSize: "2rem",
                        }}
                    >
                        {cap(props.cardTitle)}
                    </View>
                    <Divider></Divider>
                </>
            )}
            {props.children}
        </View>
    );
};

export const MarkDown = ({ content }: { content: string }) => {
    const rendered = renderMarkdown(content);
    return (
        <>
            <style>
                {`
            
                .markdown-body {
                    box-sizing: border-box;
                    padding: 1.5rem;
                }
                /* Make code blocks prettier and responsive */
                .markdown-body pre {
                    background: #141a28ff;  
                    border-radius: 8px;
                    padding: 1rem;
                    overflow: auto;
                    font-size: 0.92rem;
                    line-height: 1.45;
                }
                .markdown-body code {
                    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace;
                }
                /* optional small tweaks to match GitHub feel */
                .markdown-body h1,
                .markdown-body h2,
                .markdown-body h3 {
                    margin-top: 1.1em;
                    margin-bottom: 0.3em;
                }
            `}
            </style>
            <article class="markdown-body">{rendered}</article>
        </>
    );
};

export const Container = (props: PropsWithChildren<JSX.HtmlTag>) => {
    return (
        <>
            <View
                {...props}
                style={{
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    gap: "12px",
                    ...(typeof props.style == "object" ? props.style : {}),
                }}
            >
                {props.children}
            </View>
        </>
    );
};

export async function renderMdDescriptionFile(routePath: string, fileFullPath: string) {
    const fileContent = await readFile(fileFullPath, "utf-8");

    return (
        <>
            <Layout
                additionalHeads={
                    <>
                        <link
                            rel="stylesheet"
                            href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.8.1/github-markdown.min.css"
                        />
                        <link
                            rel="stylesheet"
                            href="https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vsc-dark-plus.min.css"
                        />
                    </>
                }
                title={`Description of route [${routePath}]`}
            >
                <Container>
                    <Card>
                        <MarkDown content={fileContent}></MarkDown>
                    </Card>
                </Container>
            </Layout>
        </>
    );
}
