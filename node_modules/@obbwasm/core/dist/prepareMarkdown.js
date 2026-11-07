import { extractMarkdownDataUriImages } from "./markdownDataUriImages.js";
import { normalizeInlineFootnotes } from "./markdownFootnotes.js";
import { injectMarkdownPaginationAnchors } from "./markdownPagination.js";
import { normalizePandocCitationPageShorthand, normalizeWikiImagesForPandoc, } from "./markdownNormalize.js";
import { stripNonBookWikiLinks } from "./pandocTypstLabels.js";
import { stripBrokenMarkdownMedia } from "./pandocTypstMedia.js";
import { normalizeWikiGlossaryIndexLinks } from "./wikiGlossaryIndex.js";
/**
 * Preprocess Markdown partagé (footnotes, wikilinks, médias, ancres pagination).
 */
export function prepareMarkdownForBookExport(sourceText, opts) {
    let markdown = sourceText || "";
    const dataUri = extractMarkdownDataUriImages(markdown);
    const dataUriFiles = dataUri.files;
    markdown = dataUri.markdown;
    markdown = normalizeInlineFootnotes(markdown);
    markdown = normalizeWikiImagesForPandoc(markdown);
    markdown = normalizeWikiGlossaryIndexLinks(markdown);
    markdown = stripNonBookWikiLinks(markdown);
    markdown = stripBrokenMarkdownMedia(markdown);
    if (opts?.bibliography) {
        markdown = normalizePandocCitationPageShorthand(markdown);
    }
    let maxAnchor = 0;
    if (opts?.paginationAnchors) {
        const injected = injectMarkdownPaginationAnchors(markdown);
        markdown = injected.markdown;
        maxAnchor = injected.maxAnchor;
    }
    return { markdown, maxAnchor, dataUriFiles };
}
//# sourceMappingURL=prepareMarkdown.js.map