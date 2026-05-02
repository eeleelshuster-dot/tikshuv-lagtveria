import { useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import { ContentManagement } from "@/components/creator/ContentManagement";
import { Button } from "@/components/ui/button";

const DebugPage = () => {
  const [test, setTest] = useState<"none" | "filter" | "content">("none");

  return (
    <div className="p-10 bg-slate-900 min-h-screen text-white">
      <h1 className="text-2xl mb-5">Strict Debug Isolation Page</h1>
      <div className="flex gap-4 mb-10">
        <Button onClick={() => setTest("filter")}>Test Filter Component</Button>
        <Button onClick={() => setTest("content")}>Test Content Management</Button>
      </div>

      <div className="border-2 border-dashed border-slate-700 p-5 rounded-xl">
        {test === "filter" && (
          <div>
            <h2 className="mb-4 text-primary">Isolated FilterPanel (Mobile View Simulation)</h2>
            <div className="max-w-[400px] border p-4 rounded-xl">
              <FilterPanel 
                searchQuery="" 
                setSearchQuery={() => {}} 
                statusFilter="all" 
                setStatusFilter={() => {}} 
                departmentFilter="all" 
                setDepartmentFilter={() => {}} 
                dateFilter={undefined} 
                setDateFilter={() => {}} 
                onClearFilters={() => {}} 
              />
            </div>
          </div>
        )}

        {test === "content" && (
          <div>
            <h2 className="mb-4 text-primary">Isolated ContentManagement</h2>
            <ContentManagement />
          </div>
        )}

        {test === "none" && <p>Select a component to isolate and test.</p>}
      </div>
    </div>
  );
};

export default DebugPage;
