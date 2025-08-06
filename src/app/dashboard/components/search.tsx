import React, { useState } from 'react';

interface CourseSearchBarProps {
  onSearch: (options: AppTypes.CourseSearchOptions) => void;
}

const CourseSearchBar: React.FC<CourseSearchBarProps> = ({ onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch({ searchTerm: value, filter, sort });
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilter(value);
    onSearch({ searchTerm, filter: value, sort });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSort(value);
    onSearch({ searchTerm, filter, sort: value });
  };

  return (
    <div className="flex flex-col text-sm md:flex-row gap-4">
      {/* Search Bar */}
      <div className="flex-1">
        <label className="block text-sm font-medium mb-1">Search Courses</label>
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="e.g. Grade 12 Maths, Python, Life Sciences..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filter Dropdown */}
      <div className="w-full md:w-1/4">
        <label className="block text-sm font-medium mb-1">Filter by Category</label>
        <select
          value={filter}
          onChange={handleFilterChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          <option value="maths">Mathematics</option>
          <option value="science">Science</option>
          <option value="tech">Technology</option>
          <option value="business">Business</option>
        </select>
      </div>

      {/* Sort Dropdown */}
      <div className="w-full md:w-1/4">
        <label className="block text-sm font-medium mb-1">Sort by</label>
        <select
          value={sort}
          onChange={handleSortChange}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="popular">Most Popular</option>
          <option value="recent">Newest</option>
          <option value="priceLow">Price: Low to High</option>
          <option value="priceHigh">Price: High to Low</option>
        </select>
      </div>
    </div>
  );
}

export default CourseSearchBar;