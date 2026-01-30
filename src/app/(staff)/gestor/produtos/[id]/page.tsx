"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import {
  CategorySchema,
  ListResponseSchema,
  ProductSchema,
  type Category,
  type Product,
  type ProductImage,
  type ProductVariant
} from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { formatPrice, resolveAssetUrl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";

const categoryListSchema = ListResponseSchema(CategorySchema);

const statusOptions = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

type VariantUpdate = { sku: string; name: string; price: string; attributes: string };

type ImageUpdate = { url: string; sortOrder: string };

export default function StaffProductDetailPage() {
  const auth = useAuth();
  const params = useParams();
  const productId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [categoryState, setCategoryState] = useState<LoadState>({ status: "loading" });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("DRAFT");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [updateState, setUpdateState] = useState<ActionState>({ status: "idle" });
  const [categoryUpdateState, setCategoryUpdateState] = useState<ActionState>({ status: "idle" });

  const [variantUpdates, setVariantUpdates] = useState<Record<string, VariantUpdate>>({});
  const [variantActions, setVariantActions] = useState<Record<string, ActionState | undefined>>({});
  const [newVariantSku, setNewVariantSku] = useState("");
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantPrice, setNewVariantPrice] = useState("");
  const [newVariantAttributes, setNewVariantAttributes] = useState("{}");
  const [variantCreateState, setVariantCreateState] = useState<ActionState>({ status: "idle" });

  const [imageUpdates, setImageUpdates] = useState<Record<string, ImageUpdate>>({});
  const [imageActions, setImageActions] = useState<Record<string, ActionState | undefined>>({});
  const [imageLink, setImageLink] = useState("");
  const [imageLinkOrder, setImageLinkOrder] = useState("");
  const [imageLinkState, setImageLinkState] = useState<ActionState>({ status: "idle" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFileOrder, setImageFileOrder] = useState("");
  const [imageUploadState, setImageUploadState] = useState<ActionState>({ status: "idle" });

  const token = useMemo(() => getAccessToken(), [auth.status]);

  const hydrateProductState = (data: Product) => {
    setProduct(data);
    setName(data.name);
    setSlug(data.slug);
    setDescription(data.description ?? "");
    setBasePrice(String(data.basePrice));
    setStatus((data.status as (typeof statusOptions)[number]) ?? "DRAFT");
    setSelectedCategories(data.categories.map((cat) => cat.categoryId));
    setVariantUpdates(
      data.variants.reduce((acc, variant) => {
        acc[variant.id] = {
          sku: variant.sku,
          name: variant.name,
          price: String(variant.price),
          attributes: JSON.stringify(variant.attributes ?? {})
        };
        return acc;
      }, {} as Record<string, VariantUpdate>)
    );
    setImageUpdates(
      data.images.reduce((acc, image) => {
        acc[image.id] = {
          url: image.url,
          sortOrder: String(image.sortOrder)
        };
        return acc;
      }, {} as Record<string, ImageUpdate>)
    );
  };

  const fetchProduct = useCallback(async () => {
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get(`/staff/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = ProductSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida do produto");
      }
      hydrateProductState(parsed.data);
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [productId, token]);

  const fetchCategories = useCallback(async () => {
    if (!token) {
      setCategoryState({ status: "error", error: "Token ausente" });
      return;
    }

    setCategoryState({ status: "loading" });
    try {
      const response = await api.get("/staff/categories", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = categoryListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de categorias");
      }
      setCategories(parsed.data.items);
      setCategoryState({ status: "ready" });
    } catch (error) {
      setCategoryState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, [token]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    if (!productId) return;
    fetchProduct();
    fetchCategories();
  }, [auth.status, fetchCategories, fetchProduct, productId]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const handleUpdateProduct = async () => {
    if (!token || !productId) return;

    const priceValue = Number(basePrice);
    if (Number.isNaN(priceValue)) {
      setUpdateState({ status: "error", error: "Preco invalido" });
      return;
    }

    setUpdateState({ status: "loading" });
    try {
      await api.put(
        `/staff/products/${productId}`,
        {
          name,
          slug,
          description: description || undefined,
          basePrice: priceValue,
          status
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUpdateState({ status: "success" });
      await fetchProduct();
    } catch (error) {
      setUpdateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdateCategories = async () => {
    if (!token || !productId) return;
    setCategoryUpdateState({ status: "loading" });
    try {
      await api.put(
        `/staff/products/${productId}/categories`,
        { categoryIds: selectedCategories },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCategoryUpdateState({ status: "success" });
      await fetchProduct();
    } catch (error) {
      setCategoryUpdateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdateVariant = async (variantId: string) => {
    if (!token) {
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const update = variantUpdates[variantId];
    if (!update?.sku || !update?.name) return;

    const priceValue = Number(update.price);
    if (Number.isNaN(priceValue)) {
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: "Preco invalido" } }));
      return;
    }

    let attributes: Record<string, unknown> = {};
    if (update.attributes.trim()) {
      try {
        attributes = JSON.parse(update.attributes) as Record<string, unknown>;
      } catch {
        setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: "JSON invalido" } }));
        return;
      }
    }

    setVariantActions((prev) => ({ ...prev, [variantId]: { status: "loading" } }));
    try {
      await api.put(
        `/staff/variants/${variantId}`,
        {
          sku: update.sku,
          name: update.name,
          price: priceValue,
          attributes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "success" } }));
      await fetchProduct();
    } catch (error) {
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!token) {
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setVariantActions((prev) => ({ ...prev, [variantId]: { status: "loading" } }));
    try {
      await api.delete(`/staff/variants/${variantId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "success" } }));
      await fetchProduct();
    } catch (error) {
      setVariantActions((prev) => ({ ...prev, [variantId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleCreateVariant = async () => {
    if (!token || !productId) return;

    const priceValue = Number(newVariantPrice);
    if (Number.isNaN(priceValue)) {
      setVariantCreateState({ status: "error", error: "Preco invalido" });
      return;
    }

    let attributes: Record<string, unknown> = {};
    if (newVariantAttributes.trim()) {
      try {
        attributes = JSON.parse(newVariantAttributes) as Record<string, unknown>;
      } catch {
        setVariantCreateState({ status: "error", error: "JSON invalido" });
        return;
      }
    }

    setVariantCreateState({ status: "loading" });
    try {
      await api.post(
        `/staff/products/${productId}/variants`,
        {
          sku: newVariantSku,
          name: newVariantName,
          price: priceValue,
          attributes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewVariantSku("");
      setNewVariantName("");
      setNewVariantPrice("");
      setNewVariantAttributes("{}");
      setVariantCreateState({ status: "success" });
      await fetchProduct();
    } catch (error) {
      setVariantCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdateImage = async (imageId: string) => {
    if (!token || !productId) {
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const update = imageUpdates[imageId];
    if (!update) return;

    const sortOrderValue = update.sortOrder.trim() ? Number(update.sortOrder) : undefined;
    if (update.sortOrder.trim() && Number.isNaN(sortOrderValue)) {
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "error", error: "Ordem invalida" } }));
      return;
    }

    setImageActions((prev) => ({ ...prev, [imageId]: { status: "loading" } }));
    try {
      await api.patch(
        `/staff/products/${productId}/images/${imageId}`,
        {
          url: update.url || undefined,
          sortOrder: sortOrderValue
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "success" } }));
      await fetchProduct();
    } catch (error) {
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!token || !productId) {
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setImageActions((prev) => ({ ...prev, [imageId]: { status: "loading" } }));
    try {
      await api.delete(`/staff/products/${productId}/images/${imageId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "success" } }));
      await fetchProduct();
    } catch (error) {
      setImageActions((prev) => ({ ...prev, [imageId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleAddImageLink = async () => {
    if (!token || !productId) return;
    if (!imageLink) {
      setImageLinkState({ status: "error", error: "URL obrigatoria" });
      return;
    }

    const orderValue = imageLinkOrder.trim() ? Number(imageLinkOrder) : undefined;
    if (imageLinkOrder.trim() && Number.isNaN(orderValue)) {
      setImageLinkState({ status: "error", error: "Ordem invalida" });
      return;
    }

    setImageLinkState({ status: "loading" });
    try {
      await api.post(
        `/staff/products/${productId}/images/link`,
        { url: imageLink, sortOrder: orderValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setImageLink("");
      setImageLinkOrder("");
      setImageLinkState({ status: "success" });
      await fetchProduct();
    } catch (error) {
      setImageLinkState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUploadImage = async () => {
    if (!token || !productId) return;
    if (!imageFile) {
      setImageUploadState({ status: "error", error: "Arquivo obrigatorio" });
      return;
    }

    const orderValue = imageFileOrder.trim() ? Number(imageFileOrder) : undefined;
    if (imageFileOrder.trim() && Number.isNaN(orderValue)) {
      setImageUploadState({ status: "error", error: "Ordem invalida" });
      return;
    }

    const formData = new FormData();
    formData.append("file", imageFile);
    if (orderValue !== undefined) {
      formData.append("sortOrder", String(orderValue));
    }

    setImageUploadState({ status: "loading" });
    try {
      await api.post(`/staff/products/${productId}/images/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      setImageFile(null);
      setImageFileOrder("");
      setImageUploadState({ status: "success" });
      await fetchProduct();
    } catch (error) {
      setImageUploadState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const renderStatusBadge = (value: string) => {
    const variant = value === "ACTIVE" ? "success" : value === "ARCHIVED" ? "neutral" : "warning";
    return <Badge variant={variant}>{value}</Badge>;
  };

  return (
    <StaffShell title="Detalhe do produto" subtitle="Atualize dados, categorias, variantes e imagens.">
      <section className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
        <Link href="/gestor/produtos" className="text-sm text-primary">
          Voltar para produtos
        </Link>

        {state.status === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : state.status === "error" ? (
          <div className="mt-4 text-sm text-amber-600">{state.error}</div>
        ) : product ? (
          <div className="mt-6 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm text-muted">Produto</div>
                <div className="text-lg font-semibold text-text">{product.name}</div>
                <div className="text-xs text-muted">Slug: {product.slug}</div>
              </div>
              {renderStatusBadge(product.status)}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Dados principais</div>
                <div className="mt-4 space-y-3">
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" />
                  <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="Slug" />
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Descricao"
                  />
                  <Input
                    type="number"
                    value={basePrice}
                    onChange={(event) => setBasePrice(event.target.value)}
                    placeholder="Preco base"
                    min="0"
                    step="0.01"
                  />
                  <Select value={status} onValueChange={(value) => setStatus(value as (typeof statusOptions)[number])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button type="button" variant="outline" onClick={handleUpdateProduct}>
                    Atualizar produto
                  </Button>
                  {updateState.status === "success" ? (
                    <div className="text-xs text-success">Produto atualizado.</div>
                  ) : null}
                  {updateState.status === "error" ? (
                    <div className="text-xs text-amber-600">{updateState.error}</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="text-sm font-semibold text-text">Categorias</div>
                {categoryState.status === "loading" ? (
                  <Skeleton className="mt-4 h-10 w-full" />
                ) : categoryState.status === "error" ? (
                  <div className="mt-4 text-sm text-amber-600">{categoryState.error}</div>
                ) : categories.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {categories.map((category) => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <Button
                          key={category.id}
                          type="button"
                          size="sm"
                          variant={isSelected ? "default" : "outline"}
                          onClick={() => toggleCategory(category.id)}
                        >
                          {category.name}
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-muted">Nenhuma categoria disponivel.</div>
                )}

                <div className="mt-4">
                  <Button type="button" onClick={handleUpdateCategories} disabled={categoryUpdateState.status === "loading"}>
                    Salvar categorias
                  </Button>
                  {categoryUpdateState.status === "success" ? (
                    <div className="mt-2 text-xs text-success">Categorias atualizadas.</div>
                  ) : null}
                  {categoryUpdateState.status === "error" ? (
                    <div className="mt-2 text-xs text-amber-600">{categoryUpdateState.error}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Variantes</div>
              {product.variants.length ? (
                <div className="mt-4 space-y-4">
                  {product.variants.map((variant: ProductVariant) => {
                    const update = variantUpdates[variant.id];
                    const action = variantActions[variant.id];
                    return (
                      <div key={variant.id} className="rounded-2xl border border-border bg-surface/80 p-4">
                        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <Input
                            value={update?.sku ?? variant.sku}
                            onChange={(event) =>
                              setVariantUpdates((prev) => ({
                                ...prev,
                                [variant.id]: {
                                  sku: event.target.value,
                                  name: update?.name ?? variant.name,
                                  price: update?.price ?? String(variant.price),
                                  attributes: update?.attributes ?? JSON.stringify(variant.attributes ?? {})
                                }
                              }))
                            }
                          />
                          <Input
                            value={update?.name ?? variant.name}
                            onChange={(event) =>
                              setVariantUpdates((prev) => ({
                                ...prev,
                                [variant.id]: {
                                  sku: update?.sku ?? variant.sku,
                                  name: event.target.value,
                                  price: update?.price ?? String(variant.price),
                                  attributes: update?.attributes ?? JSON.stringify(variant.attributes ?? {})
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <Input
                            type="number"
                            value={update?.price ?? String(variant.price)}
                            onChange={(event) =>
                              setVariantUpdates((prev) => ({
                                ...prev,
                                [variant.id]: {
                                  sku: update?.sku ?? variant.sku,
                                  name: update?.name ?? variant.name,
                                  price: event.target.value,
                                  attributes: update?.attributes ?? JSON.stringify(variant.attributes ?? {})
                                }
                              }))
                            }
                            min="0"
                            step="0.01"
                          />
                          <Input
                            value={update?.attributes ?? JSON.stringify(variant.attributes ?? {})}
                            onChange={(event) =>
                              setVariantUpdates((prev) => ({
                                ...prev,
                                [variant.id]: {
                                  sku: update?.sku ?? variant.sku,
                                  name: update?.name ?? variant.name,
                                  price: update?.price ?? String(variant.price),
                                  attributes: event.target.value
                                }
                              }))
                            }
                            placeholder="Atributos JSON"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateVariant(variant.id)}
                            disabled={action?.status === "loading"}
                          >
                            Atualizar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteVariant(variant.id)}
                            disabled={action?.status === "loading"}
                          >
                            Remover
                          </Button>
                        </div>
                        {action?.status === "error" ? (
                          <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                        ) : action?.status === "success" ? (
                          <div className="mt-2 text-xs text-success">Atualizado.</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">Nenhuma variante cadastrada.</div>
              )}

              <div className="mt-6 rounded-2xl border border-border bg-surface/80 p-4">
                <div className="text-sm font-semibold text-text">Adicionar variante</div>
                <div className="mt-3 space-y-2">
                  <Input
                    placeholder="SKU"
                    value={newVariantSku}
                    onChange={(event) => setNewVariantSku(event.target.value)}
                  />
                  <Input
                    placeholder="Nome da variante"
                    value={newVariantName}
                    onChange={(event) => setNewVariantName(event.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Preco"
                    value={newVariantPrice}
                    onChange={(event) => setNewVariantPrice(event.target.value)}
                    min="0"
                    step="0.01"
                  />
                  <Input
                    placeholder="Atributos JSON"
                    value={newVariantAttributes}
                    onChange={(event) => setNewVariantAttributes(event.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={handleCreateVariant}
                  disabled={variantCreateState.status === "loading"}
                >
                  {variantCreateState.status === "loading" ? "Criando" : "Adicionar variante"}
                </Button>
                {variantCreateState.status === "success" ? (
                  <div className="mt-2 text-xs text-success">Variante criada.</div>
                ) : null}
                {variantCreateState.status === "error" ? (
                  <div className="mt-2 text-xs text-amber-600">{variantCreateState.error}</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Imagens</div>
              {product.images.length ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  {product.images.map((image: ProductImage) => {
                    const update = imageUpdates[image.id];
                    const action = imageActions[image.id];
                    const previewUrl = resolveAssetUrl(image.url);
                    return (
                      <div key={image.id} className="rounded-2xl border border-border bg-surface/80 p-4">
                        <div className="flex gap-4">
                          <div className="h-20 w-20 overflow-hidden rounded-xl bg-border/70">
                            {previewUrl ? (
                              <img src={previewUrl} alt={image.id} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                                Sem imagem
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <Input
                              value={update?.url ?? image.url}
                              onChange={(event) =>
                                setImageUpdates((prev) => ({
                                  ...prev,
                                  [image.id]: {
                                    url: event.target.value,
                                    sortOrder: update?.sortOrder ?? String(image.sortOrder)
                                  }
                                }))
                              }
                            />
                            <Input
                              type="number"
                              value={update?.sortOrder ?? String(image.sortOrder)}
                              onChange={(event) =>
                                setImageUpdates((prev) => ({
                                  ...prev,
                                  [image.id]: {
                                    url: update?.url ?? image.url,
                                    sortOrder: event.target.value
                                  }
                                }))
                              }
                              min="0"
                              step="1"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateImage(image.id)}
                            disabled={action?.status === "loading"}
                          >
                            Atualizar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteImage(image.id)}
                            disabled={action?.status === "loading"}
                          >
                            Remover
                          </Button>
                        </div>
                        {action?.status === "error" ? (
                          <div className="mt-2 text-xs text-amber-600">{action.error}</div>
                        ) : action?.status === "success" ? (
                          <div className="mt-2 text-xs text-success">Atualizado.</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-muted">Nenhuma imagem cadastrada.</div>
              )}

              <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-border bg-surface/80 p-4">
                  <div className="text-sm font-semibold text-text">Adicionar por link</div>
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="URL da imagem"
                      value={imageLink}
                      onChange={(event) => setImageLink(event.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Ordem"
                      value={imageLinkOrder}
                      onChange={(event) => setImageLinkOrder(event.target.value)}
                      min="0"
                      step="1"
                    />
                  </div>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={handleAddImageLink}
                    disabled={imageLinkState.status === "loading"}
                  >
                    {imageLinkState.status === "loading" ? "Enviando" : "Adicionar imagem"}
                  </Button>
                  {imageLinkState.status === "success" ? (
                    <div className="mt-2 text-xs text-success">Imagem adicionada.</div>
                  ) : null}
                  {imageLinkState.status === "error" ? (
                    <div className="mt-2 text-xs text-amber-600">{imageLinkState.error}</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-surface/80 p-4">
                  <div className="text-sm font-semibold text-text">Upload de imagem</div>
                  <div className="mt-3 space-y-2">
                    <Input type="file" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
                    <Input
                      type="number"
                      placeholder="Ordem"
                      value={imageFileOrder}
                      onChange={(event) => setImageFileOrder(event.target.value)}
                      min="0"
                      step="1"
                    />
                  </div>
                  <Button
                    type="button"
                    className="mt-3"
                    onClick={handleUploadImage}
                    disabled={imageUploadState.status === "loading"}
                  >
                    {imageUploadState.status === "loading" ? "Enviando" : "Enviar arquivo"}
                  </Button>
                  {imageUploadState.status === "success" ? (
                    <div className="mt-2 text-xs text-success">Upload concluido.</div>
                  ) : null}
                  {imageUploadState.status === "error" ? (
                    <div className="mt-2 text-xs text-amber-600">{imageUploadState.error}</div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface/70 p-4">
              <div className="text-sm font-semibold text-text">Resumo</div>
              <div className="mt-3 text-sm text-text">
                <div>Preco base: {formatPrice(product.basePrice)}</div>
                <div>Variantes: {product.variants.length}</div>
                <div>Imagens: {product.images.length}</div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </StaffShell>
  );
}
