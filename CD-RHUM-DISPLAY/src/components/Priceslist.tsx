
import { parse as parseYaml } from "yaml";
import { useMemo, useState } from "preact/hooks";
import pricesYaml from "../assets/prices.yml?raw";
import { BouncingCategoryTitle } from "./BouncingCategoryTitle";
import { HelloAssoYamlScraper } from "./HelloAssoYamlScraper";

type PriceItem = {
    name: string;
    available?: number;
    price?: number;
};

type PriceCategory = {
    title?: string;
    unitPrice?: number | string;
    color?: string;
    borderClass?: string;
    borderColor?: string;
    items?: Array<string | { name?: string; available?: number; price?: number }>;
};

type LayoutColumn = {
    id?: string;
    categories?: string[];
};

type PricesConfig = {
    layout?: {
        columns?: LayoutColumn[];
    };
    categories?: Record<string, PriceCategory>;
};

type NormalizedCategory = {
    key: string;
    title: string;
    unitPrice: string;
    borderClass: string;
    borderColor?: string;
    items: PriceItem[];
};

function formatPrice(value?: number | string): string {
    if (value === undefined || value === null || value === "") {
        return "";
    }

    if (typeof value === "number") {
        return value.toFixed(2);
    }

    const numericValue = Number.parseFloat(value);
    if (Number.isNaN(numericValue)) {
        return value;
    }

    return numericValue.toFixed(2);
}

function parseConfig(yamlContent: string): PricesConfig {
    try {
        const parsed = parseYaml(yamlContent);
        if (parsed && typeof parsed === "object") {
            return parsed as PricesConfig;
        }
    } catch {
        return {};
    }

    return {};
}

function normalizeItems(items: PriceCategory["items"]): PriceItem[] {
    if (!items || !Array.isArray(items)) {
        return [];
    }

    return items
        .map((item) => {
            if (typeof item === "string") {
                return { name: item.trim() };
            }

            return {
                name: item?.name?.trim() ?? "",
                available: item?.available,
                price: item?.price,
            };
        })
        .filter((item) => item.name.length > 0);
}

const categoryBorderClass: Record<string, string> = {
    energy: "price-category-box--energy",
    soda: "price-category-box--soda",
    snacks: "price-category-box--snacks",
    other: "price-category-box--other",
};

export function PricesList() {
    const [enrichedYaml, setEnrichedYaml] = useState<string>(pricesYaml);

    const pricesConfig = useMemo(() => parseConfig(enrichedYaml), [enrichedYaml]);

    const normalizedCategories = useMemo(() => Object.entries(pricesConfig.categories ?? {}).reduce<
        Record<string, NormalizedCategory>
    >((accumulator, [key, category]) => {
        const items = normalizeItems(category.items);
        if (items.length === 0) {
            return accumulator;
        }

        accumulator[key] = {
            key,
            title: category.title?.trim() || key,
            unitPrice: formatPrice(category.unitPrice),
            borderClass: category.borderClass || categoryBorderClass[key] || categoryBorderClass.other,
            borderColor: category.color || category.borderColor,
            items,
        };
        return accumulator;
    }, {}), [pricesConfig.categories]);

    const configuredColumns = useMemo(() => (pricesConfig.layout?.columns ?? []).map((column, index) => ({
        id: column.id || `column-${index}`,
        categories: (column.categories ?? []).filter((category) => normalizedCategories[category]),
    })), [pricesConfig.layout?.columns, normalizedCategories]);

    const usedCategories = useMemo(
        () => new Set(configuredColumns.flatMap((column) => column.categories)),
        [configuredColumns],
    );

    const remainingCategories = useMemo(
        () => Object.keys(normalizedCategories).filter((key) => !usedCategories.has(key)),
        [normalizedCategories, usedCategories],
    );

    const columns = useMemo(() => (configuredColumns.length > 0
        ? configuredColumns.map((column, index) => {
            if (index !== configuredColumns.length - 1 || remainingCategories.length === 0) {
                return column;
            }

            return {
                ...column,
                categories: [...column.categories, ...remainingCategories],
            };
        })
        : [{ id: "column-0", categories: remainingCategories }]), [configuredColumns, remainingCategories]);

    const renderCategoryBox = (category: string) => {
        const categoryData = normalizedCategories[category];
        if (!categoryData || categoryData.items.length === 0) {
            return null;
        }

        const categoryHeightWeight = Math.max(1, categoryData.items.length + 1);

        const categoryTitle = categoryData.unitPrice
            ? `${categoryData.unitPrice}€`
            : categoryData.title.toUpperCase();

        const categoryStyle = {
            flexGrow: categoryHeightWeight,
            borderColor: categoryData.borderColor,
        };

        return (
            <section
                key={category}
                class={`price-category-box ${categoryData.borderClass}`}
                style={categoryStyle}
            >
                <BouncingCategoryTitle text={categoryTitle} />
                <ul class="price-items-list">
                    {categoryData.items.map((item) => {
                        const displayName = typeof item.available === "number"
                            ? `${item.name} (${item.available})`
                            : `${item.name} (?)`;

                        return (
                            <li key={`${category}-${item.name}`} class="price-item-row">
                                <span>
                                    {displayName}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </section>
        );
    };

    return (
        <div class="prices-list-root">
            <HelloAssoYamlScraper
                inputYaml={pricesYaml}
                onOutputYaml={setEnrichedYaml}
            />
            <div class="prices-columns-layout">
                {columns.map((column, index) => (
                    <div
                        key={column.id}
                        class={index === 0 ? "prices-main-column" : "prices-side-column"}
                    >
                        {column.categories.map((category) => renderCategoryBox(category))}
                    </div>
                ))}
            </div>
        </div>
    );
}
