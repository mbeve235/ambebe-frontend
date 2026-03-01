"use client";

import { useCallback, useEffect, useState } from "react";
import { StaffShell } from "@/components/staff-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { CategorySchema, ListResponseSchema, type Category } from "@/lib/api-schema";
import { getAccessToken } from "@/lib/auth";
import { useAuth } from "@/hooks/use-auth";

const categoryListSchema = ListResponseSchema(CategorySchema);

type LoadState = { status: "loading" | "ready" | "error"; error?: string };

type ActionState = { status: "idle" | "loading" | "success" | "error"; error?: string };

export default function StaffCategoriesPage() {
  const auth = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [createState, setCreateState] = useState<ActionState>({ status: "idle" });

  const [updates, setUpdates] = useState<Record<string, { name: string; slug: string; description: string }>>({});
  const [actionState, setActionState] = useState<Record<string, ActionState | undefined>>({});

  const fetchCategories = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ status: "error", error: "Token ausente" });
      return;
    }

    setState({ status: "loading" });
    try {
      const response = await api.get("/staff/categories", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const parsed = categoryListSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new Error("Resposta invalida de categorias");
      }
      setCategories(parsed.data.items);
      setUpdates(
        parsed.data.items.reduce((acc, category) => {
          acc[category.id] = {
            name: category.name,
            slug: category.slug,
            description: category.description ?? ""
          };
          return acc;
        }, {} as Record<string, { name: string; slug: string; description: string }>)
      );
      setState({ status: "ready" });
    } catch (error) {
      setState({ status: "error", error: getApiErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    fetchCategories();
  }, [auth.status, fetchCategories]);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setCreateState({ status: "error", error: "Token ausente" });
      return;
    }

    setCreateState({ status: "loading" });
    try {
      await api.post(
        "/staff/categories",
        { name, slug, description: description || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setName("");
      setSlug("");
      setDescription("");
      setCreateState({ status: "success" });
      await fetchCategories();
    } catch (error) {
      setCreateState({ status: "error", error: getApiErrorMessage(error) });
    }
  };

  const handleUpdate = async (categoryId: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    const update = updates[categoryId];
    if (!update?.name || !update?.slug) return;

    setActionState((prev) => ({ ...prev, [categoryId]: { status: "loading" } }));
    try {
      await api.put(
        `/staff/categories/${categoryId}`,
        {
          name: update.name,
          slug: update.slug,
          description: update.description || undefined
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "success" } }));
      await fetchCategories();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  const handleDelete = async (categoryId: string) => {
    const token = getAccessToken();
    if (!token) {
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "error", error: "Token ausente" } }));
      return;
    }

    setActionState((prev) => ({ ...prev, [categoryId]: { status: "loading" } }));
    try {
      await api.delete(`/staff/categories/${categoryId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "success" } }));
      await fetchCategories();
    } catch (error) {
      setActionState((prev) => ({ ...prev, [categoryId]: { status: "error", error: getApiErrorMessage(error) } }));
    }
  };

  return (
    <StaffShell title="Categorias" subtitle="Crie, organize e mantenha as categorias do catalogo.">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Categorias cadastradas</div>
          {state.status === "loading" ? (
            <div className="mt-4 space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : state.status === "error" ? (
            <div className="mt-4 text-sm text-amber-600">{state.error}</div>
          ) : categories.length ? (
            <div className="mt-4 space-y-4">
              {categories.map((category) => {
                const update = updates[category.id];
                const action = actionState[category.id];
                return (
                  <div key={category.id} className="rounded-2xl border border-border bg-surface/70 p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                      <Input
                        value={update?.name ?? category.name}
                        onChange={(event) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [category.id]: {
                              name: event.target.value,
                              slug: update?.slug ?? category.slug,
                              description: update?.description ?? category.description ?? ""
                            }
                          }))
                        }
                      />
                      <Input
                        value={update?.slug ?? category.slug}
                        onChange={(event) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [category.id]: {
                              name: update?.name ?? category.name,
                              slug: event.target.value,
                              description: update?.description ?? category.description ?? ""
                            }
                          }))
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <Input
                        value={update?.description ?? category.description ?? ""}
                        onChange={(event) =>
                          setUpdates((prev) => ({
                            ...prev,
                            [category.id]: {
                              name: update?.name ?? category.name,
                              slug: update?.slug ?? category.slug,
                              description: event.target.value
                            }
                          }))
                        }
                        placeholder="Descricao"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdate(category.id)}
                        disabled={action?.status === "loading"}
                      >
                        Atualizar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(category.id)}
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
            <div className="mt-4 text-sm text-muted">Nenhuma categoria encontrada.</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface/80 p-6 shadow-soft">
          <div className="text-sm font-semibold text-text">Nova categoria</div>
          <form className="mt-4 space-y-3" onSubmit={handleCreate}>
            <Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
            <Input placeholder="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} required />
            <Input placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button type="submit" disabled={createState.status === "loading"}>
              {createState.status === "loading" ? "Criando" : "Criar categoria"}
            </Button>
            {createState.status === "success" ? (
              <div className="text-xs text-success">Categoria criada.</div>
            ) : null}
            {createState.status === "error" ? (
              <div className="text-xs text-amber-600">{createState.error}</div>
            ) : null}
          </form>
        </div>
      </section>
    </StaffShell>
  );
}
