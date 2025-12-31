/**
 * Documentation navigation component.
 * Renders Fumadocs page tree using sidebar components.
 */

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
} from "lucide-react";
import type {
  Root as PageTreeRoot,
  Node as PageTreeNode,
  Folder as PageTreeFolder,
} from "fumadocs-core/page-tree";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";

/**
 * Props for NavDocs component.
 */
interface NavDocsProps {
  /** Fumadocs page tree from source.pageTree */
  tree: PageTreeRoot;
}

/**
 * Renders the documentation navigation tree in the sidebar.
 * Includes a "Back to Dashboard" link and the full docs tree.
 *
 * @param tree - Fumadocs page tree structure
 */
export function NavDocs({ tree }: NavDocsProps) {
  return (
    <>
      {/* Back to Dashboard link */}
      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
                <span>Back to Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {/* Documentation tree */}
      <SidebarGroup>
        <SidebarGroupLabel>Documentation</SidebarGroupLabel>
        <SidebarMenu>
          {tree.children.map((node: PageTreeNode, index: number) => (
            <DocsTreeNode key={`${node.type}-${index}`} node={node} />
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}

/**
 * Props for DocsTreeNode component.
 */
interface DocsTreeNodeProps {
  /** A node from the Fumadocs page tree */
  node: PageTreeNode;
}

/**
 * Recursively renders a node from the docs tree.
 * Handles page, folder, and separator node types.
 *
 * @param node - The tree node to render
 */
function DocsTreeNode({ node }: DocsTreeNodeProps) {
  const pathname = usePathname();

  if (node.type === "separator") {
    return (
      <SidebarMenuItem className="pt-4 first:pt-0">
        <SidebarGroupLabel className="px-0">{node.name}</SidebarGroupLabel>
      </SidebarMenuItem>
    );
  }

  if (node.type === "page") {
    const isActive = pathname === node.url;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link href={node.url}>
            <FileText className="size-4" />
            <span>{node.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  if (node.type === "folder") {
    return <DocsFolderNode node={node} />;
  }

  return null;
}

/**
 * Props for DocsFolderNode component.
 */
interface DocsFolderNodeProps {
  /** A folder node from the Fumadocs page tree */
  node: PageTreeFolder;
}

/**
 * Renders a collapsible folder node with its children.
 *
 * @param node - The folder node to render
 */
function DocsFolderNode({ node }: DocsFolderNodeProps) {
  const pathname = usePathname();

  // Check if any child is active to auto-expand
  const hasActiveChild = React.useMemo(() => {
    const checkActive = (n: PageTreeNode): boolean => {
      if (n.type === "page") return pathname === n.url;
      if (n.type === "folder") return n.children.some(checkActive);
      return false;
    };
    return node.children.some(checkActive);
  }, [node.children, pathname]);

  const [isOpen, setIsOpen] = React.useState(hasActiveChild);

  // Update open state when active child changes
  React.useEffect(() => {
    if (hasActiveChild) setIsOpen(true);
  }, [hasActiveChild]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            <FolderIcon className="size-4" />
            <span>{node.name}</span>
            <ChevronRight
              className={`ml-auto size-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {node.children.map((child: PageTreeNode, index: number) => (
              <DocsTreeNode key={`${child.type}-${index}`} node={child} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
