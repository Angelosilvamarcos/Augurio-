type GitHubFile = {
  name: string;
  path: string;
  type: string;
  sha?: string;
  download_url?: string | null;
  content?: string;
  encoding?: string;
};

function headers(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function githubRequest(path: string): Promise<any> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: headers(),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.message || `GitHub respondeu HTTP ${response.status}.`
    );
  }

  return data;
}

export async function readGitHubFile(
  repository: string,
  path: string,
  ref?: string
): Promise<{ text: string; summary: string }> {
  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const data = (await githubRequest(
    `/repos/${repository}/contents/${encodedPath}${query}`
  )) as GitHubFile;

  if (data.type !== "file" || !data.content) {
    throw new Error(`O caminho "${path}" não é um arquivo de texto.`);
  }

  const text = Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8");

  return {
    text,
    summary: `Arquivo ${repository}/${path} lido com sucesso.`,
  };
}

export async function listGitHubPath(
  repository: string,
  path = "",
  ref?: string
): Promise<{ text: string; summary: string }> {
  const encodedPath = path
    ? "/" + path.split("/").map(encodeURIComponent).join("/")
    : "";
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const data = (await githubRequest(
    `/repos/${repository}/contents${encodedPath}${query}`
  )) as GitHubFile[];

  if (!Array.isArray(data)) {
    throw new Error(`O caminho "${path}" não é uma pasta.`);
  }

  const text = data
    .map((item) => `${item.type === "dir" ? "DIR " : "FILE"} ${item.path}`)
    .join("\n");

  return {
    text,
    summary: `Conteúdo de ${repository}/${path || "/"} listado com sucesso.`,
  };
}

export async function executeGitHubStep(
  input: Record<string, unknown> | undefined
): Promise<{ text: string; summary: string }> {
  const repository =
    typeof input?.repository === "string" ? input.repository.trim() : "";
  const path = typeof input?.path === "string" ? input.path.trim() : "";
  const ref = typeof input?.ref === "string" ? input.ref.trim() : undefined;
  const operation =
    typeof input?.operation === "string" ? input.operation : "read_file";

  if (!repository) {
    throw new Error("A ferramenta GitHub precisa do campo input.repository (owner/repo).");
  }

  if (operation === "list") {
    return listGitHubPath(repository, path, ref);
  }

  if (operation === "read_file") {
    if (!path) {
      throw new Error("A leitura de arquivo no GitHub precisa do campo input.path.");
    }
    return readGitHubFile(repository, path, ref);
  }

  throw new Error(
    `Operação GitHub "${operation}" ainda não está habilitada. Por segurança, esta primeira versão executa apenas leitura.`
  );
}
