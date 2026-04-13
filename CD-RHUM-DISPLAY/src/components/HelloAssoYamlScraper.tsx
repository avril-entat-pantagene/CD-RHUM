import { useEffect } from "preact/hooks";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

type ProductScrapeData = {
    available: number;
    price?: number;
};

type YamlItem = string | {
    name?: string;
    available?: number;
    price?: number;
};

type YamlCategory = {
    unitPrice?: number | string;
    items?: YamlItem[];
};

type YamlConfig = {
    categories?: Record<string, YamlCategory>;
};

type HelloAssoYamlScraperProps = {
    inputYaml: string;
    onOutputYaml: (outputYaml: string) => void;
    sourceUrl?: string;
    refreshIntervalMs?: number;
};

const DEFAULT_SOURCE_URL = "https://www.helloasso.com/associations/cd-rom-telecom/boutiques/cdromtcom";
const DEFAULT_REFRESH_INTERVAL_MS = 30_000;

function normalizeProductName(productName: string): string {
    return productName
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

function parsePriceValue(priceText?: string): number | undefined {
    if (!priceText) {
        return undefined;
    }

    const normalized = priceText.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
        return undefined;
    }

    return parsed;
}

function parseInputYaml(yamlContent: string): YamlConfig {
    try {
        const parsed = parseYaml(yamlContent);
        if (parsed && typeof parsed === "object") {
            return parsed as YamlConfig;
        }
    } catch {
        return {};
    }

    return {};
}

function parseTextStocks(content: string): Record<string, ProductScrapeData> {
    const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const stocks: Record<string, ProductScrapeData> = {};

    for (let index = 1; index < lines.length; index += 1) {
        const quantityLine = lines[index];
        const quantityMatch = quantityLine.match(/(\d+)\s+produit/i);
        if (!quantityMatch) {
            continue;
        }

        const available = Number.parseInt(quantityMatch[1], 10);
        if (Number.isNaN(available)) {
            continue;
        }

        const productName = lines[index - 1] ?? "";
        if (!productName) {
            continue;
        }

        const maybePriceLine = lines[index + 1] ?? "";
        const priceMatch = maybePriceLine.match(/(\d+[\.,]\d{2})\s*€/);

        stocks[normalizeProductName(productName)] = {
            available,
            price: parsePriceValue(priceMatch?.[1]),
        };
    }

    return stocks;
}

function enrichYamlItems(inputYaml: string, stockByName: Record<string, ProductScrapeData>): string {
    const config = parseInputYaml(inputYaml);

    const categories = config.categories ?? {};

    const enrichedCategories = Object.entries(categories).reduce<Record<string, YamlCategory>>((accumulator, [key, category]) => {
        const fallbackCategoryPrice = parsePriceValue(String(category.unitPrice ?? ""));

        const enrichedItems = (category.items ?? []).map((item) => {
            const itemName = typeof item === "string"
                ? item.trim()
                : item?.name?.trim() ?? "";

            const stock = stockByName[normalizeProductName(itemName)];

            return {
                name: itemName,
                available: stock?.available,
                price: stock?.price ?? fallbackCategoryPrice,
            };
        });

        accumulator[key] = {
            ...category,
            items: enrichedItems,
        };

        return accumulator;
    }, {});

    const output: YamlConfig = {
        ...config,
        categories: enrichedCategories,
    };

    return stringifyYaml(output);
}

async function scrapeAndEnrichYaml(inputYaml: string, sourceUrl: string): Promise<string> {
    const scrapeUrl = `https://r.jina.ai/http://${sourceUrl}`;

    const response = await fetch(scrapeUrl);
    if (!response.ok) {
        return inputYaml;
    }

    const rawContent = await response.text();
    const stockByName = parseTextStocks(rawContent);

    if (Object.keys(stockByName).length === 0) {
        return inputYaml;
    }

    return enrichYamlItems(inputYaml, stockByName);
}

export function HelloAssoYamlScraper({
    inputYaml,
    onOutputYaml,
    sourceUrl = DEFAULT_SOURCE_URL,
    refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}: HelloAssoYamlScraperProps) {
    useEffect(() => {
        let isMounted = true;
        let isRunning = false;

        const run = async () => {
            if (isRunning) {
                return;
            }

            isRunning = true;
            try {
                const outputYaml = await scrapeAndEnrichYaml(inputYaml, sourceUrl);
                if (isMounted) {
                    onOutputYaml(outputYaml);
                }
            } catch {
                if (isMounted) {
                    onOutputYaml(inputYaml);
                }
            } finally {
                isRunning = false;
            }
        };

        void run();

        const intervalId = window.setInterval(() => {
            void run();
        }, refreshIntervalMs);

        return () => {
            isMounted = false;
            window.clearInterval(intervalId);
        };
    }, [inputYaml, onOutputYaml, refreshIntervalMs, sourceUrl]);

    return null;
}
